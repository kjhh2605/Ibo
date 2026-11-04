package com.streetfitting.app.plugins.facemask;

import android.graphics.Bitmap;
import android.content.pm.ApplicationInfo;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.streetfitting.app.plugins.segmenter.model.*;
import com.streetfitting.app.plugins.store.*;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicLong;

@CapacitorPlugin(name = "FaceMask")
public class FaceMaskPlugin extends Plugin {
    private static final ExecutorService WORKER=Executors.newSingleThreadExecutor();
    private static final AtomicLong VERSION=new AtomicLong();
    private volatile boolean destroyed;
    private HeadGeometry.Config config;
    private interface Work {JSObject run() throws Exception;}
    private static JSObject object(String key,Object value){JSObject o=new JSObject();o.put(key,value==null?JSONObject.NULL:value);return o;}
    private void stage(String value){if(!destroyed)notifyListeners("stage",object("stage",value));}
    private void submit(PluginCall call,Work work) {
        WORKER.execute(()->{
            try {if(destroyed)throw new IOException("cancelled");if(config==null)config=CompositionConfig.load(getContext());JSObject result=work.run();if(destroyed)throw new IOException("cancelled");call.resolve(result);}
            catch(Exception e){String code=e.getMessage();if(code==null||!code.matches("[a-z_]{1,64}"))code="inference_failed";call.reject("Privacy operation failed",code,object("retryable",false));}
        });
    }
    private static JSObject metrics(HeadGeometry geometry,long[] counts) {
        JSObject out=object("personAccepted",geometry!=null);out.put("headAreaRatio",geometry==null?JSONObject.NULL:geometry.areaRatio());
        out.put("gtHeadPixels",counts==null?JSONObject.NULL:counts[0]);out.put("exposedHeadPixels",counts==null?JSONObject.NULL:counts[1]);out.put("privacyPassed",counts==null?JSONObject.NULL:counts[1]==0);return out;
    }
    public static JSObject metrics(BoundaryMetrics values) {
        JSObject out=object("neckColorDeltaE95",values.neckColorDeltaE95);out.put("shoulderColorDeltaE95",values.shoulderColorDeltaE95==null?JSONObject.NULL:values.shoulderColorDeltaE95);
        out.put("neckOffsetRatio95",values.neckOffsetRatio95==null?JSONObject.NULL:values.neckOffsetRatio95);out.put("shoulderOffsetRatio95",values.shoulderOffsetRatio95==null?JSONObject.NULL:values.shoulderOffsetRatio95);
        out.put("thresholdVersion",values.thresholdVersion==null?JSONObject.NULL:values.thresholdVersion);out.put("passed",values.passed);out.put("decision",values.decision);return out;
    }
    private File sidecar(long version) throws IOException {
        File dir=new File(getContext().getFilesDir(),"facemask");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("io_error");return new File(dir,version+".json");
    }
    private Bitmap asset(JSObject asset) throws Exception {
        if(asset==null)throw new IOException("invalid_argument");
        Bitmap original=Images.decode(getContext(),asset.getString("file"));
        if(original.getWidth()!=asset.getInteger("w",0)||original.getHeight()!=asset.getInteger("h",0)){original.recycle();throw new IOException("invalid_argument");}return original;
    }
    @PluginMethod public void register(PluginCall call) {submit(call,()->registerAsset(call.getObject("asset")));}
    private JSObject registerAsset(JSObject input) throws Exception {
        Bitmap original=null,masked=null,wire=null;List<File> temporary=new ArrayList<>();File metadata=null;
        boolean committed=false;File inputFile=input==null?null:Images.local(getContext(),input.getString("file"));
        NativeRepository repo=RepositoryProvider.get(getContext());
        try {
            original=asset(input);stage("segmenting");HeadGeometry geometry;
            try {geometry=FaceMaskCore.detect(getContext(),original,config);}
            catch(HeadGeometry.Rejected e){JSObject out=object("ok",false);out.put("reason",e.reason);out.put("metrics",metrics(null,null));return out;}
            if(destroyed)throw new IOException("cancelled");stage("masking");
            File raw=Images.temp(getContext(),"self-"),head=Images.temp(getContext(),"head-"),safe=Images.temp(getContext(),"masked-");Collections.addAll(temporary,raw,head,safe);
            Images.png(original,raw);Images.maskPng(geometry.headMask(),geometry.w,geometry.h,head);
            masked=FaceMaskCore.mask(original,geometry,config.mode);wire=FaceMaskCore.wire(masked,safe);
            // A fresh encoder strips EXIF; verify actual output decode, dimensions and opaque pixels.
            Bitmap check=android.graphics.BitmapFactory.decodeFile(safe.getPath());
            if(check==null)throw new IOException("io_error");
            try {if(check.getWidth()!=wire.getWidth()||check.getHeight()!=wire.getHeight()||check.hasAlpha())throw new IOException("io_error");}finally{check.recycle();}
            long version=VERSION.updateAndGet(previous->Math.max(System.currentTimeMillis(),previous+1));
            metadata=sidecar(version);JSObject data=object("mode",config.mode);data.put("w",geometry.w);data.put("h",geometry.h);data.put("cropOffset",config.mode.equals("b")?geometry.headBottom+1:0);data.put("wireW",wire.getWidth());data.put("wireH",wire.getHeight());
            Files.write(metadata.toPath(),data.toString().getBytes(StandardCharsets.UTF_8));
            JSObject self=object("file",raw.toURI().toString());self.put("headMask",head.toURI().toString());self.put("maskedFile",safe.toURI().toString());self.put("updatedAt",version);
            if(destroyed||inputFile==null||!inputFile.isFile())throw new IOException("cancelled");
            JSObject saved=repo.replaceSelfPhoto(object("selfPhoto",self));committed=true;
            JSObject out=object("ok",true);out.put("selfPhoto",saved);out.put("metrics",metrics(geometry,null));return out;
        } finally {
            if(wire!=null&&wire!=masked)wire.recycle();if(masked!=null&&masked!=original)masked.recycle();if(original!=null)original.recycle();
            for(File file:temporary)file.delete();if(!committed&&metadata!=null)metadata.delete();
            // Only transient imports are consumed; never remove an existing owned SelfPhoto input.
            if(inputFile!=null&&inputFile.getCanonicalPath().startsWith(getContext().getCacheDir().getCanonicalPath()+"/"))inputFile.delete();
            cleanSidecars(repo);
        }
    }
    private void cleanSidecars(NativeRepository repo) {
        File dir=new File(getContext().getFilesDir(),"facemask");File[] entries=dir.listFiles();if(entries==null)return;
        for(File file:entries) {
            String name=file.getName();if(!name.matches("[0-9]+\\.json"))continue;
            try {long version=Long.parseLong(name.substring(0,name.length()-5));JSObject key=object("updatedAt",version);repo.retainSelf(key);repo.releaseSelf(key);}
            catch(Exception e){if("invalid_reference".equals(e.getMessage()))file.delete();}
        }
    }
    @PluginMethod public void evaluateFixture(PluginCall call) {
        submit(call,()->{
            Boolean expected=call.getBoolean("expectedPerson");String gtRef=call.getString("groundTruthHeadMask");
            if(expected==null||expected&&gtRef==null||!expected&&gtRef!=null)throw new IOException("invalid_argument");
            Bitmap original=asset(call.getObject("asset")),gt=null,masked=null,wire=null;File temp=null;
            try {
                if(expected){gt=Images.decode(getContext(),gtRef);FaceMaskCore.validateGroundTruth(gt,original.getWidth(),original.getHeight());}
                HeadGeometry geometry=null;String reason=null;
                try {geometry=FaceMaskCore.detect(getContext(),original,config);}catch(HeadGeometry.Rejected e){reason=e.reason;}
                long[] counts=null;
                if(geometry!=null) {
                    masked=FaceMaskCore.mask(original,geometry,config.mode);temp=Images.temp(getContext(),"evaluation-");wire=FaceMaskCore.wire(masked,temp);
                    if(gt!=null)counts=FaceMaskCore.exposure(gt,geometry,config.mode,wire.getWidth(),wire.getHeight());
                }
                JSObject out=object("registrationOk",geometry!=null);out.put("reason",reason==null?JSONObject.NULL:reason);out.put("metrics",metrics(geometry,counts));out.put("passed",expected?geometry!=null&&counts!=null&&counts[1]==0:geometry==null);return out;
            } finally {if(wire!=null&&wire!=masked)wire.recycle();if(masked!=null&&masked!=original)masked.recycle();if(gt!=null)gt.recycle();original.recycle();if(temp!=null)temp.delete();}
        });
    }
    @PluginMethod public void compose(PluginCall call) {
        submit(call,()->{
            Long version=call.getLong("selfUpdatedAt");if(version==null)throw new IOException("invalid_argument");
            NativeRepository repo=RepositoryProvider.get(getContext());JSObject key=object("updatedAt",version),self;
            boolean verificationBuild=(getContext().getApplicationInfo().flags&ApplicationInfo.FLAG_DEBUGGABLE)!=0;
            BoundaryMetrics measured=new BoundaryMetrics(null,null,null,null,config.thresholdsForSource(null,verificationBuild));
            try {self=repo.retainSelf(key);}catch(Exception e){return failure("self_photo_changed",measured);}
            Bitmap original=null,provider=null,result=null;File derived=null;
            try {
                File metadata=sidecar(version);if(!metadata.isFile())return failure("self_photo_changed",measured);
                JSONObject data=new JSONObject(new String(Files.readAllBytes(metadata.toPath()),StandardCharsets.UTF_8));
                File sourceFile=Images.local(getContext(),self.getString("file"));
                String sourceHash=config.provisionalSourceImageSha256!=null&&verificationBuild?Models.hash(sourceFile):null;
                BoundaryMetrics.Thresholds thresholds=config.thresholdsForSource(sourceHash,verificationBuild);
                measured=new BoundaryMetrics(null,null,null,null,thresholds);
                File providerFile=Images.local(getContext(),call.getString("providerFile"));String hash=Models.hash(providerFile);
                provider=Images.decode(getContext(),call.getString("providerFile"));original=Images.decode(getContext(),self.getString("file"));stage("compositing");
                HeadGeometry source,output;
                try {source=FaceMaskCore.detect(getContext(),original,config);output=FaceMaskCore.detect(getContext(),provider,config);}
                catch(HeadGeometry.Rejected e){return failure("unsafe_output",measured);}
                measured=BoundaryMetrics.measure(original,source,provider,output,data.getInt("cropOffset"),thresholds);
                if(measured.passed)result=FaceMaskCore.compose(original,source,provider,output,data.getInt("cropOffset"));
                else {int cut=output.headBottom+1;if(cut>=provider.getHeight())return failure("unsafe_output",measured);result=Bitmap.createBitmap(provider,0,cut,provider.getWidth(),provider.getHeight()-cut);}
                if(destroyed)throw new IOException("cancelled");
                derived=Images.temp(getContext(),"result-");Images.png(result,derived);
                if(!hash.equals(Models.hash(providerFile)))throw new IOException("io_error");
                if(sourceHash!=null&&!sourceHash.equals(Models.hash(sourceFile)))throw new IOException("io_error");
                JSObject out=object("ok",true);out.put("file",derived.toURI().toString());out.put("faceless",!measured.passed);out.put("metrics",metrics(measured));derived=null;return out;
            } finally {if(derived!=null)derived.delete();if(result!=null&&result!=provider)result.recycle();if(provider!=null)provider.recycle();if(original!=null)original.recycle();repo.releaseSelf(key);cleanSidecars(repo);}
        });
    }
    private static JSObject failure(String reason,BoundaryMetrics measured){JSObject out=object("ok",false);out.put("reason",reason);out.put("metrics",metrics(measured));return out;}
    @Override protected void handleOnDestroy(){destroyed=true;super.handleOnDestroy();}
}
