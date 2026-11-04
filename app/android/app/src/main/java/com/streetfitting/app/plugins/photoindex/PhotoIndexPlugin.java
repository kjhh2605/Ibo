package com.streetfitting.app.plugins.photoindex;

import android.content.Context;
import android.graphics.Bitmap;
import ai.onnxruntime.*;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.streetfitting.app.plugins.segmenter.model.*;
import com.streetfitting.app.plugins.store.*;
import org.json.*;
import java.io.*;
import java.nio.FloatBuffer;
import java.util.*;
import java.util.concurrent.*;

@CapacitorPlugin(name = "PhotoIndex")
public class PhotoIndexPlugin extends Plugin {
    private static final ExecutorService INFERENCE=Executors.newSingleThreadExecutor();
    private static final ConcurrentHashMap<String,CompletableFuture<JSObject>> FLIGHTS=new ConcurrentHashMap<>();
    private static final Set<PhotoIndexPlugin> LISTENERS=ConcurrentHashMap.newKeySet();
    private final ExecutorService calls=Executors.newCachedThreadPool();
    private volatile boolean destroyed;
    private static JSObject object(String key,Object value) { JSObject o=new JSObject();o.put(key,value);return o; }
    private static JSObject get(NativeRepository repo,String entity,String id) throws Exception {
        JSObject request=object("entity",entity);request.put("id",id);return repo.get(request);
    }
    public static float[] infer(Context context,Bitmap bitmap) throws Exception {
        try(OnnxTensor input=OnnxTensor.createTensor(Models.ENV,Images.pe(bitmap),new long[]{1,3,384,384});
            OrtSession.Result result=Models.session(context,2).run(Collections.singletonMap("image",input))) {
            FloatBuffer buffer=((OnnxTensor)result.get("embedding").orElseThrow(()->new IOException("model_invalid"))).getFloatBuffer();
            float[] vector=new float[512];buffer.get(vector);double sum=0;
            for(float value:vector) { if(!Float.isFinite(value)) throw new IOException("inference_failed");sum+=(double)value*value; }
            double norm=Math.sqrt(sum);if(!(norm>0)) throw new IOException("inference_failed");
            for(int i=0;i<vector.length;i++) vector[i]/=norm;
            return vector;
        }
    }
    public static void dispatch(Context context,String photoId) { indexOnce(context.getApplicationContext(),photoId); }
    private static CompletableFuture<JSObject> indexOnce(Context context,String id) {
        if(id==null||id.isEmpty()) return CompletableFuture.failedFuture(new IOException("invalid_argument"));
        CompletableFuture<JSObject> fresh=new CompletableFuture<>(), prior=FLIGHTS.putIfAbsent(id,fresh);
        if(prior!=null) return prior;
        INFERENCE.execute(()->{
            NativeRepository repo=RepositoryProvider.get(context);
            try {
                JSObject photo=get(repo,"Photo",id);
                if(photo==null) throw new IOException("not_found");
                JSObject existing=get(repo,"PhotoEmbedding",id);
                if("done".equals(photo.getString("indexState")) && existing!=null) {fresh.complete(existing);return;}
                Bitmap bitmap=Images.decode(context,photo.getString("file"));
                float[] vector;
                try { vector=infer(context,bitmap); } finally {bitmap.recycle();}
                JSObject embedding=object("photoId",id);embedding.put("model","pe-core-t16-image");embedding.put("dim",512);
                JSArray values=new JSArray();for(float value:vector) values.put(value);embedding.put("vector",values);
                JSObject committed=repo.commitEmbedding(object("embedding",embedding));
                fresh.complete(committed);
                JSObject event=object("photoId",id);event.put("state","done");
                for(PhotoIndexPlugin plugin:LISTENERS) if(!plugin.destroyed) plugin.notifyListeners("indexed",event);
            } catch(Exception e) {
                try {
                    repo.markIndexFailed(object("photoId",id));
                    JSObject event=object("photoId",id);event.put("state","failed");
                    for(PhotoIndexPlugin plugin:LISTENERS) if(!plugin.destroyed) plugin.notifyListeners("indexed",event);
                } catch(Exception ignored) { /* Deletion wins; never recreate a row. */ }
                fresh.completeExceptionally(e);
            } finally {FLIGHTS.remove(id,fresh);}
        });
        return fresh;
    }
    @Override public void load() {
        LISTENERS.add(this);
        calls.execute(()->{
            try {for(JSObject photo:photos(RepositoryProvider.get(getContext()))) if("pending".equals(photo.getString("indexState"))) dispatch(getContext(),photo.getString("id"));}
            catch(Exception ignored) { /* Explicit calls report repository/model failures to their caller. */ }
        });
    }
    @PluginMethod public void index(PluginCall call) {
        indexOnce(getContext().getApplicationContext(),call.getString("photoId")).whenComplete((result,error)->{
            if(destroyed) {reject(call,new IOException("cancelled"));return;}
            if(error!=null) reject(call,error);else call.resolve(result);
        });
    }
    private static List<JSObject> photos(NativeRepository repo) throws Exception {
        List<JSObject> result=new ArrayList<>();String cursor=null;
        do {
            JSObject request=object("entity","Photo");request.put("limit",200);if(cursor!=null)request.put("cursor",cursor);
            JSObject page=repo.list(request);JSONArray items=page.getJSONArray("items");
            for(int i=0;i<items.length();i++) result.add(JSObject.fromJSONObject(items.getJSONObject(i)));
            cursor=page.isNull("nextCursor")?null:page.getString("nextCursor");
        } while(cursor!=null);
        return result;
    }
    @PluginMethod public void search(PluginCall call) {
        calls.execute(()->{
            try {
                JSArray input=call.getArray("phraseVector");Integer k=call.getInt("k");
                if(input==null||input.length()!=512||k==null||k<1||k>3||call.getData().getDouble("k")!=k) throw new IOException("invalid_vector");
                double[] query=new double[512];double norm=0;
                for(int i=0;i<512;i++) {query[i]=input.getDouble(i);if(!Double.isFinite(query[i]))throw new IOException("invalid_vector");norm+=query[i]*query[i];}
                if(Math.abs(Math.sqrt(norm)-1)>1e-4) throw new IOException("invalid_vector");
                Set<String> selected=null;JSArray ids=call.getArray("photoIds");
                if(ids!=null){selected=new HashSet<>();for(int i=0;i<ids.length();i++)selected.add(ids.getString(i));}
                NativeRepository repo=RepositoryProvider.get(getContext());List<JSObject> scope=new ArrayList<>();
                for(JSObject photo:photos(repo)) if(selected==null?"item".equals(photo.getString("kind")):selected.contains(photo.getString("id")))scope.add(photo);
                long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(30);
                List<JSObject> ranked=new ArrayList<>();
                for(JSObject initial:scope) {
                    if(destroyed)throw new IOException("cancelled");
                    String id=initial.getString("id");JSObject photo=get(repo,"Photo",id);if(photo==null)continue;
                    if("pending".equals(photo.getString("indexState"))) {
                        long remaining=deadline-System.nanoTime();if(remaining<=0)throw new IOException("index_unavailable");
                        try { indexOnce(getContext(),id).get(remaining,TimeUnit.NANOSECONDS); } catch(Exception e) {throw new IOException("index_unavailable",e);}
                        photo=get(repo,"Photo",id);if(photo==null)continue;
                    }
                    if(!"done".equals(photo.getString("indexState")))throw new IOException("index_unavailable");
                    JSObject embedding=get(repo,"PhotoEmbedding",id);if(embedding==null)throw new IOException("index_unavailable");
                    JSONArray vector=embedding.getJSONArray("vector");double score=0;
                    for(int i=0;i<512;i++)score+=query[i]*vector.getDouble(i);
                    JSObject row=object("photoId",id);row.put("score",Math.max(-1,Math.min(1,score)));row.put("takenAt",photo.getLong("takenAt"));ranked.add(row);
                }
                ranked.sort((a,b)->{int c=Double.compare(b.optDouble("score"),a.optDouble("score"));if(c!=0)return c;c=Long.compare(b.optLong("takenAt"),a.optLong("takenAt"));return c!=0?c:a.getString("photoId").compareTo(b.getString("photoId"));});
                JSArray output=new JSArray();for(int i=0;i<Math.min(k,ranked.size());i++){JSObject row=ranked.get(i);row.remove("takenAt");output.put(row);}
                // Capacitor arrays are returned through JSObject's raw JSON bridge envelope.
                call.resolve(new JSObject().put("results",output));
            } catch(Exception e) {reject(call,e);}
        });
    }
    private static void reject(PluginCall call,Throwable error) {
        while(error.getCause()!=null && (error instanceof CompletionException||error instanceof ExecutionException))error=error.getCause();
        String code=error.getMessage();if(code==null||!code.matches("[a-z_]{1,64}"))code="inference_failed";
        JSObject details=object("retryable",true);call.reject("Photo indexing failed",code,details);
    }
    @Override protected void handleOnDestroy() {destroyed=true;LISTENERS.remove(this);calls.shutdownNow();super.handleOnDestroy();}
}
