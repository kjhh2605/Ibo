package com.streetfitting.app.plugins.facemask;

import android.content.Context;
import android.graphics.Bitmap;
import com.streetfitting.app.plugins.segmenter.model.*;
import java.io.*;
import java.util.*;

public final class FaceMaskCore {
    private FaceMaskCore() {}
    public static HeadGeometry detect(Context context,Bitmap bitmap,HeadGeometry.Config config) throws Exception {
        EdgeEngine engine=EdgeEngine.SHARED;
        synchronized(engine) {
            String handle=engine.prepare(context,bitmap,null);
            try {
                List<EdgeEngine.Mask> masks=engine.tap(context,handle,.5,.5);
                HeadGeometry.Rejected first=null;
                for(EdgeEngine.Mask mask:masks) {
                    try {return HeadGeometry.detect(mask.pixels,bitmap.getWidth(),bitmap.getHeight(),config);}
                    catch(HeadGeometry.Rejected e){if(first==null)first=e;}
                }
                throw first==null?new HeadGeometry.Rejected("person_not_found"):first;
            } finally {engine.release();}
        }
    }
    public static Bitmap mask(Bitmap original,HeadGeometry geometry,String mode) {
        int w=geometry.w,h=geometry.h;
        if("b".equals(mode))return Bitmap.createBitmap(original,0,geometry.headBottom+1,w,h-geometry.headBottom-1);
        int[] pixels=new int[w*h];original.getPixels(pixels,0,w,0,0,w,h);
        for(int y=0;y<h;y++)for(int x=0;x<w;x++)if(geometry.protectedPixel(x,y,mode))pixels[y*w+x]=0xff7f7f7f;else pixels[y*w+x]|=0xff000000;
        return Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888);
    }
    /** Nearest sampling has a single source-pixel footprint, never blends a protected edge. */
    public static Bitmap wire(Bitmap masked,File file) throws IOException {
        int w=masked.getWidth(),h=masked.getHeight();double scale=Math.min(1,2048.0/Math.max(w,h));
        Bitmap result=nearest(masked,Math.max(1,(int)(w*scale)),Math.max(1,(int)(h*scale)));
        while(true) {
            Images.png(result,file);
            if(file.length()<=4L*1024*1024)return result;
            int nextW=(int)(result.getWidth()*.8),nextH=(int)(result.getHeight()*.8);
            if(nextW<1||nextH<1){if(result!=masked)result.recycle();throw new IOException("io_error");}
            Bitmap smaller=nearest(masked,nextW,nextH);if(result!=masked)result.recycle();result=smaller;
        }
    }
    private static Bitmap nearest(Bitmap source,int w,int h) {
        if(w==source.getWidth()&&h==source.getHeight())return source;
        int[] pixels=new int[w*h];
        for(int y=0;y<h;y++)for(int x=0;x<w;x++)pixels[y*w+x]=source.getPixel(Math.min(source.getWidth()-1,(int)((x+.5)*source.getWidth()/w)),Math.min(source.getHeight()-1,(int)((y+.5)*source.getHeight()/h)));
        return Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888);
    }
    public static long validateGroundTruth(Bitmap gt,int w,int h) throws IOException {
        if(gt.getWidth()!=w||gt.getHeight()!=h)throw new IOException("invalid_argument");
        long count=0;
        for(int y=0;y<h;y++)for(int x=0;x<w;x++) {
            int rgb=gt.getPixel(x,y);
            if(rgb!=0xff000000&&rgb!=0xffffffff)throw new IOException("invalid_argument");
            if(rgb==0xffffffff)count++;
        }
        if(count==0)throw new IOException("invalid_argument");
        return count;
    }
    /** Counts source contribution, not accidental equality to gray RGB. */
    public static long[] exposure(Bitmap gt,HeadGeometry g,String mode,int wireW,int wireH) throws IOException {
        long count=validateGroundTruth(gt,g.w,g.h);
        boolean[] contributes=new boolean[g.w*g.h];
        int offset="b".equals(mode)?g.headBottom+1:0,sourceH=g.h-offset;
        for(int y=0;y<wireH;y++)for(int x=0;x<wireW;x++) {
            int sx=Math.min(g.w-1,(int)((x+.5)*g.w/wireW)),sy=offset+Math.min(sourceH-1,(int)((y+.5)*sourceH/wireH));
            if(!g.protectedPixel(sx,sy,mode))contributes[sy*g.w+sx]=true;
        }
        long exposed=0;for(int y=0;y<g.h;y++)for(int x=0;x<g.w;x++)if(contributes[y*g.w+x]&&gt.getPixel(x,y)==0xffffffff)exposed++;
        return new long[]{count,exposed};
    }
    /** Every generated protected pixel must map to a restorable source pixel. */
    public static boolean compositionEligible(HeadGeometry source,HeadGeometry generated,int w,int h,int cropOffset) {
        if(cropOffset!=0||w<=0||h<=0||generated.w!=w||generated.h!=h)return false;
        double sx=(double)source.w/w,sy=(double)source.h/h;
        return (generated.headLeft+.5)*sx-.5>=source.headLeft
            && (generated.headRight+.5)*sx-.5<=source.headRight
            && (generated.headTop+.5)*sy-.5>=source.headTop
            && (generated.headBottom+.5)*sy-.5<=source.headBottom;
    }
    public static Bitmap compose(Bitmap original,HeadGeometry source,Bitmap provider,HeadGeometry generated,int cropOffset) {
        if(!compositionEligible(source,generated,provider.getWidth(),provider.getHeight(),cropOffset))throw new IllegalArgumentException("unsafe_output");
        int w=provider.getWidth(),h=provider.getHeight();int[] pixels=new int[w*h];provider.getPixels(pixels,0,w,0,0,w,h);
        double sx=(double)source.w/w,sy=(double)(source.h-cropOffset)/h;
        for(int y=0;y<h;y++)for(int x=0;x<w;x++) {
            double ox=(x+.5)*sx-.5,oy=(y+.5)*sy-.5+cropOffset;
            if(ox<source.headLeft||ox>source.headRight||oy<source.headTop||oy>source.headBottom)continue;
            double edge=Math.min(Math.min(ox-source.headLeft,source.headRight-ox),Math.min(oy-source.headTop,source.headBottom-oy));
            boolean protectedOutput=x>=generated.headLeft&&x<=generated.headRight&&y>=generated.headTop&&y<=generated.headBottom;
            double alpha=protectedOutput?1:Math.max(0,Math.min(1,edge/2));
            int sourcePixel=original.getPixel(Math.max(0,Math.min(source.w-1,(int)Math.round(ox))),Math.max(0,Math.min(source.h-1,(int)Math.round(oy))));
            int dest=pixels[y*w+x],rgb=0xff000000;
            for(int shift=0;shift<=16;shift+=8)rgb|=((int)Math.round(((sourcePixel>>shift)&255)*alpha+((dest>>shift)&255)*(1-alpha)))<<shift;
            pixels[y*w+x]=rgb;
        }
        return Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888);
    }
}
