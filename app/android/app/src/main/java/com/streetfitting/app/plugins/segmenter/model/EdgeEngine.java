package com.streetfitting.app.plugins.segmenter.model;

import android.content.Context;
import android.graphics.Bitmap;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.*;
import java.util.*;

/** Owns one encoder cache across Segmenter and FaceMask; all access is serialized. */
public final class EdgeEngine {
    public static final EdgeEngine SHARED = new EdgeEngine();
    private OrtSession.Result features;
    private String handle;
    private int width,height;
    private final List<File> files=new ArrayList<>();
    private File source;
    private long sourceLength,sourceModified;
    private EdgeEngine() {}
    public static final class Mask {
        public final byte[] pixels;
        public final float score;
        public final int decoderIndex;
        public final int left,top,right,bottom;
        Mask(byte[] pixels,float score,int index,int left,int top,int right,int bottom) {
            this.pixels=pixels;this.score=score;this.decoderIndex=index;this.left=left;this.top=top;this.right=right;this.bottom=bottom;
        }
    }
    public synchronized String prepare(Context context,Bitmap bitmap,File source) throws Exception {
        release();
        try(OnnxTensor input=OnnxTensor.createTensor(Models.ENV,Images.edge(bitmap),new long[]{1,3,1024,1024})) {
            features=Models.session(context,0).run(Collections.singletonMap("image",input));
        }
        width=bitmap.getWidth();height=bitmap.getHeight();
        this.source=source;
        sourceLength=source==null?0:source.length();sourceModified=source==null?0:source.lastModified();
        return handle=UUID.randomUUID().toString();
    }
    public synchronized int width(String id) throws IOException { check(id);return width; }
    public synchronized int height(String id) throws IOException { check(id);return height; }
    public synchronized void retainFile(String id,File file) throws IOException { check(id);files.add(file); }
    public synchronized void release(String id) throws IOException { check(id);release(); }
    public synchronized void release() {
        if(features!=null) features.close();features=null;handle=null;source=null;
        for(File file:files) file.delete();files.clear();
    }
    private void check(String id) throws IOException {
        if(handle==null || !handle.equals(id)) throw new IOException("handle_expired");
        if(source!=null && (!source.isFile() || source.length()!=sourceLength || source.lastModified()!=sourceModified)) {
            release();throw new IOException("handle_expired");
        }
    }
    public synchronized List<Mask> tap(Context context,String id,double x,double y) throws Exception {
        check(id);
        if(!Double.isFinite(x)||!Double.isFinite(y)||x<0||x>1||y<0||y>1) throw new IOException("invalid_argument");
        Map<String,OnnxTensor> feed=new HashMap<>();
        for(String key:new String[]{"embedding","high0","high1"}) feed.put(key,(OnnxTensor)features.get(key).orElseThrow(()->new IOException("model_invalid")));
        try(OnnxTensor coords=OnnxTensor.createTensor(Models.ENV,FloatBuffer.wrap(new float[]{(float)Math.min(1023,x*1024),(float)Math.min(1023,y*1024)}),new long[]{1,1,2});
            OnnxTensor labels=OnnxTensor.createTensor(Models.ENV,LongBuffer.wrap(new long[]{1}),new long[]{1,1})) {
            feed.put("coords",coords);feed.put("labels",labels);
            try(OrtSession.Result result=Models.session(context,1).run(feed)) {
                FloatBuffer logits=((OnnxTensor)result.get("masks").orElseThrow(()->new IOException("model_invalid"))).getFloatBuffer();
                FloatBuffer scores=((OnnxTensor)result.get("scores").orElseThrow(()->new IOException("model_invalid"))).getFloatBuffer();
                List<Mask> masks=new ArrayList<>(3);
                for(int i=0;i<3;i++) {
                    float score=scores.get(i);
                    if(!Float.isFinite(score)) throw new IOException("inference_failed");
                    byte[] pixels=new byte[width*height];
                    int left=width,top=height,right=-1,bottom=-1;
                    for(int row=0;row<height;row++) {
                        float sy=Math.max(0,(row+.5f)*256/height-.5f); int y0=(int)sy,y1=Math.min(255,y0+1);float fy=sy-y0;
                        for(int col=0;col<width;col++) {
                            float sx=Math.max(0,(col+.5f)*256/width-.5f);int x0=(int)sx,x1=Math.min(255,x0+1);float fx=sx-x0;
                            int base=i*65536;
                            float a=logits.get(base+y0*256+x0),b=logits.get(base+y0*256+x1),c=logits.get(base+y1*256+x0),d=logits.get(base+y1*256+x1);
                            float value=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
                            if(!Float.isFinite(value)) throw new IOException("inference_failed");
                            if(value>0) { pixels[row*width+col]=(byte)255;left=Math.min(left,col);right=Math.max(right,col);top=Math.min(top,row);bottom=Math.max(bottom,row); }
                        }
                    }
                    if(right<0) throw new IOException("inference_failed");
                    masks.add(new Mask(pixels,score,i,left,top,right,bottom));
                }
                masks.sort(Comparator.<Mask>comparingDouble(m->-m.score).thenComparingInt(m->m.decoderIndex));
                return masks;
            }
        }
    }
}
