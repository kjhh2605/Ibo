package com.streetfitting.verification;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Bundle;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.streetfitting.app.plugins.facemask.BoundaryMetrics;
import com.streetfitting.app.plugins.facemask.FaceMaskCore;
import com.streetfitting.app.plugins.facemask.HeadGeometry;
import com.streetfitting.app.plugins.segmenter.model.Images;
import com.streetfitting.app.plugins.store.NativeRepository;
import com.streetfitting.app.plugins.store.RepositoryProvider;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

/** Test APK only. Runs actual repository and ML cores; never installs a product hook. */
@RunWith(AndroidJUnit4.class)
public final class NativeVerificationTest {
    private static JSObject obj(Object... pairs) {
        JSObject result = new JSObject();
        for (int i=0; i<pairs.length; i+=2) result.put((String)pairs[i], pairs[i+1] == null ? JSONObject.NULL : pairs[i+1]);
        return result;
    }
    private static JSObject copy(JSONObject value) throws Exception { return new JSObject(value.toString()); }
    private static JSObject fix(JSONObject spot, long time) throws Exception {
        return obj("t",time,"lat",spot.getDouble("lat"),"lng",spot.getDouble("lng"),"accuracyM",spot.optDouble("accuracyM",5));
    }
    @Test public void execute() throws Exception {
        Context context=InstrumentationRegistry.getInstrumentation().getTargetContext();
        Bundle args=InstrumentationRegistry.getArguments();
        File input=Images.local(context,args.getString("sfInput"));
        JSONObject request=new JSONObject(new String(Files.readAllBytes(input.toPath()),StandardCharsets.UTF_8));
        JSONObject result;
        switch(request.getString("operation")) {
            case "seed": result=seed(context,request); break;
            case "mask": result=mask(context,request); break;
            case "measure": result=measure(context,request); break;
            default: throw new IllegalArgumentException("unknown_verification_operation");
        }
        result.put("status","passed");
        File output=Images.local(context,args.getString("sfOutput"));
        Files.write(output.toPath(),result.toString().getBytes(StandardCharsets.UTF_8));
    }
    private static JSONObject seed(Context context,JSONObject request) throws Exception {
        NativeRepository repo=RepositoryProvider.get(context);
        assertEquals("seed_requires_empty_trip_database",0,repo.list(obj("entity","Trip","limit",200)).getJSONArray("items").length());
        JSONObject seed=request.getJSONObject("seed");
        JSONArray trips=seed.getJSONArray("Trip"),shops=seed.getJSONArray("Shop"),photos=seed.getJSONArray("Photo");
        Map<String,String> tripIds=new HashMap<>(),shopIds=new HashMap<>(),photoIds=new HashMap<>();
        int photoCount=0;
        for(int i=0;i<trips.length();i++) {
            JSONObject trip=trips.getJSONObject(i);JSONObject first=null;
            for(int j=0;j<shops.length();j++) {JSONObject shop=shops.getJSONObject(j);if(shop.getString("tripId").equals(trip.getString("id"))&&shop.getInt("n")==1)first=shop;}
            assertNotNull("seed_first_shop_missing",first);
            JSObject started=repo.startSession(obj("fix",fix(first.getJSONObject("spot"),trip.getLong("startedAt"))));
            String tripId=started.getJSONObject("trip").getString("id");tripIds.put(trip.getString("id"),tripId);
            for(int j=0;j<shops.length();j++) {
                JSONObject shop=shops.getJSONObject(j);if(!shop.getString("tripId").equals(trip.getString("id")))continue;
                JSONObject actual=shop.getInt("n")==1?started.getJSONObject("shop"):repo.newShop(obj("tripId",tripId,"fix",fix(shop.getJSONObject("spot"),shop.getLong("startedAt"))));
                String shopId=actual.getString("id");shopIds.put(shop.getString("id"),shopId);
                if(!shop.isNull("note"))repo.updateShop(obj("id",shopId,"note",shop.getString("note")));
                for(int k=0;k<photos.length();k++) {
                    JSONObject photo=photos.getJSONObject(k);if(!photo.getString("shopId").equals(shop.getString("id")))continue;
                    JSObject item=copy(photo);String photoId=UUID.randomUUID().toString();item.put("id",photoId);photoIds.put(photo.getString("id"),photoId);item.put("tripId",tripId);item.put("shopId",shopId);
                    File source=Images.local(context,photo.getString("file"));
                    File temporary=File.createTempFile("s11-seed-",".png",context.getCacheDir());
                    Files.copy(source.toPath(),temporary.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                    item.put("file",temporary.getCanonicalPath());
                    repo.commitPhoto(obj("photo",item));photoCount++;
                }
            }
            repo.stopSession(obj("tripId",tripId,"endedAt",trip.getLong("endedAt")));
            assertEquals(0,repo.list(obj("entity","TrailPoint","tripId",tripId,"limit",200)).getJSONArray("items").length());
        }
        // Leave photos pending: the real PhotoIndex owner must run inference.
        // Synthetic basis vectors from unit seed are never accepted as native proof.
        return obj("trips",tripIds.size(),"shops",shopIds.size(),"photos",photoCount,"tripIds",new JSONObject(tripIds),"shopIds",new JSONObject(shopIds),"photoIds",new JSONObject(photoIds),"syntheticEmbeddingsCommitted",0,"actualIdsGenerated",true);
    }
    private static JSONObject mask(Context context,JSONObject request) throws Exception {
        String mode=request.getString("mode");HeadGeometry.Config config=new HeadGeometry.Config(mode,null);
        Bitmap source=Images.decode(context,request.getString("source"));
        Bitmap gt=Images.decode(context,request.getString("groundTruth"));
        Bitmap masked=null,wire=null;
        try {
            HeadGeometry geometry=FaceMaskCore.detect(context,source,config);
            masked=FaceMaskCore.mask(source,geometry,mode);
            File output=Images.local(context,request.getString("maskedOutput"));
            wire=FaceMaskCore.wire(masked,output);
            long[] exposure=FaceMaskCore.exposure(gt,geometry,mode,wire.getWidth(),wire.getHeight());
            assertTrue("empty_human_gt",exposure[0]>0);assertEquals("head_exposed",0,exposure[1]);
            return obj("gtHeadPixels",exposure[0],"exposedHeadPixels",exposure[1],"width",wire.getWidth(),"height",wire.getHeight(),"cropOffset","b".equals(mode)?geometry.headBottom+1:0,"mode",mode);
        } finally {if(wire!=null&&wire!=masked)wire.recycle();if(masked!=null&&masked!=source)masked.recycle();gt.recycle();source.recycle();}
    }
    private static JSONObject measure(Context context,JSONObject request) throws Exception {
        Bitmap source=Images.decode(context,request.getString("source"));
        Bitmap provider=Images.decode(context,request.getString("provider"));
        try {
            HeadGeometry a=FaceMaskCore.detect(context,source,HeadGeometry.DEFAULT);
            HeadGeometry b;
            try {b=FaceMaskCore.detect(context,provider,HeadGeometry.DEFAULT);}
            catch(HeadGeometry.Rejected rejected) {return obj("ok",false,"reason","unsafe_output","decision","unsafe_output","metrics",JSONObject.NULL);}
            BoundaryMetrics.Thresholds thresholds=null;
            if(request.has("thresholds")&&!request.isNull("thresholds")) {
                JSONObject t=request.getJSONObject("thresholds");
                thresholds=new BoundaryMetrics.Thresholds(t.getString("version"),t.getDouble("maxBoundaryColorDeltaE"),t.getDouble("maxBoundaryOffsetRatio"));
            }
            BoundaryMetrics m=BoundaryMetrics.measure(source,a,provider,b,request.getInt("cropOffset"),thresholds);
            boolean eligible=FaceMaskCore.compositionEligible(a,b,provider.getWidth(),provider.getHeight(),request.getInt("cropOffset"));
            boolean previewWritten=false;
            if(eligible&&request.has("previewOutput")&&!request.isNull("previewOutput")) {
                Bitmap preview=FaceMaskCore.compose(source,a,provider,b,request.getInt("cropOffset"));
                try {Images.png(preview,Images.local(context,request.getString("previewOutput")));previewWritten=true;}
                finally {preview.recycle();}
            }
            return obj("ok",true,"faceless",!m.passed,"compositionEligible",eligible,"previewWritten",previewWritten,"metrics",obj("neckColorDeltaE95",m.neckColorDeltaE95,"shoulderColorDeltaE95",m.shoulderColorDeltaE95,"neckOffsetRatio95",m.neckOffsetRatio95,"shoulderOffsetRatio95",m.shoulderOffsetRatio95,"thresholdVersion",m.thresholdVersion,"decision",m.decision,"passed",m.passed));
        } finally {provider.recycle();source.recycle();}
    }
}
