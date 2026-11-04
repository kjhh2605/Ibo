package com.streetfitting.app.plugins.segmenter;

import android.graphics.Bitmap;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.streetfitting.app.plugins.segmenter.model.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

@CapacitorPlugin(name = "Segmenter")
public class SegmenterPlugin extends Plugin {
    private final ExecutorService worker=Executors.newSingleThreadExecutor();
    private volatile boolean destroyed;
    private String ownedHandle;
    private String ownedAssetId;
    private interface Work { JSObject run() throws Exception; }
    private void submit(PluginCall call,Work work) {
        worker.execute(()->{
            try {
                if(destroyed) throw new IOException("cancelled");
                JSObject output=work.run();
                if(destroyed) throw new IOException("cancelled");
                call.resolve(output);
            } catch(Exception e) { JSObject details=new JSObject();details.put("retryable",false);call.reject("Segmentation failed",code(e),details); }
        });
    }
    private static String code(Exception e) {
        String message=e.getMessage();
        return message!=null && message.matches("[a-z_]{1,64}")?message:"inference_failed";
    }
    @PluginMethod public void prepare(PluginCall call) {
        submit(call,()->{
            JSObject asset=call.getObject("asset");
            if(asset==null) throw new IOException("invalid_argument");
            String assetId=asset.getString("id");
            if(assetId==null||!assetId.matches("[A-Za-z0-9_-]{1,200}"))throw new IOException("invalid_argument");
            String ref=asset.getString("file");
            Bitmap bitmap=Images.decode(getContext(),ref);
            try {
                if(asset.getInteger("w",0)!=bitmap.getWidth()||asset.getInteger("h",0)!=bitmap.getHeight()) throw new IOException("invalid_argument");
                EdgeEngine engine=EdgeEngine.SHARED;
                synchronized(engine) {
                    ownedHandle=engine.prepare(getContext(),bitmap,Images.local(getContext(),ref));
                    ownedAssetId=assetId;
                    JSObject result=new JSObject();result.put("handle",ownedHandle);result.put("w",bitmap.getWidth());result.put("h",bitmap.getHeight());
                    JSObject event=new JSObject();event.put("handle",ownedHandle);event.put("assetId",asset.getString("id"));
                    notifyListeners("prepared",event);return result;
                }
            } finally { bitmap.recycle(); }
        });
    }
    @PluginMethod public void tap(PluginCall call) { submit(call,()->decode(call,false)); }
    @PluginMethod public void person(PluginCall call) { submit(call,()->decode(call,true)); }
    private JSObject decode(PluginCall call,boolean person) throws Exception {
        String handle=call.getString("handle");
        Double x=person?.5:call.getDouble("x"),y=person?.5:call.getDouble("y");
        if(x==null||y==null) throw new IOException("invalid_argument");
        EdgeEngine engine=EdgeEngine.SHARED;
        synchronized(engine) {
            if(handle==null||!handle.equals(ownedHandle))throw new IOException("handle_expired");
            int w=engine.width(handle),h=engine.height(handle);
            List<EdgeEngine.Mask> masks=engine.tap(getContext(),handle,x,y);
            JSArray array=new JSArray();List<File> pending=new ArrayList<>(3);
            try {
                File dir=new File(getContext().getCacheDir(),"candidates/"+ownedAssetId);
                if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("io_error");
                for(EdgeEngine.Mask mask:masks) {
                    File file=File.createTempFile("mask-",".png",dir);pending.add(file);
                    Images.maskPng(mask.pixels,w,h,file);
                    JSObject row=new JSObject();row.put("mask",file.toURI().toString());row.put("score",mask.score);
                    JSArray bbox=new JSArray();bbox.put((double)mask.left/w);bbox.put((double)mask.top/h);bbox.put((double)(mask.right-mask.left+1)/w);bbox.put((double)(mask.bottom-mask.top+1)/h);row.put("bbox",bbox);array.put(row);
                }
                for(File file:pending)engine.retainFile(handle,file);
                JSObject result=new JSObject();result.put("masks",array);pending.clear();return result;
            } finally {for(File file:pending)file.delete();}
        }
    }
    @PluginMethod public void release(PluginCall call) { submit(call,()->{
        String handle=call.getString("handle");if(handle==null||!handle.equals(ownedHandle))throw new IOException("handle_expired");
        EdgeEngine.SHARED.release(handle);ownedHandle=null;ownedAssetId=null;return new JSObject();
    }); }
    @Override protected void handleOnDestroy() {
        destroyed=true;
        worker.execute(()->{if(ownedHandle!=null) try {EdgeEngine.SHARED.release(ownedHandle);} catch(IOException ignored) {} });
        worker.shutdown();super.handleOnDestroy();
    }
}
