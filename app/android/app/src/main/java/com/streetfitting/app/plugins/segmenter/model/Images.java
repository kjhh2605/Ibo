package com.streetfitting.app.plugins.segmenter.model;

import android.content.Context;
import android.graphics.*;
import android.net.Uri;
import androidx.exifinterface.media.ExifInterface;
import java.io.*;
import java.nio.FloatBuffer;
import java.util.zip.*;

public final class Images {
    private Images() {}
    public static File local(Context context, String ref) throws IOException {
        if (ref == null) throw new IOException("invalid_argument");
        Uri uri = Uri.parse(ref);
        if (uri.getScheme() != null && !"file".equals(uri.getScheme())) throw new IOException("invalid_argument");
        File file = new File(uri.getScheme() == null ? ref : uri.getPath()).getCanonicalFile();
        String p = file.getPath();
        if (!p.startsWith(context.getFilesDir().getCanonicalPath() + "/") && !p.startsWith(context.getCacheDir().getCanonicalPath() + "/")) throw new IOException("invalid_argument");
        return file;
    }
    public static Bitmap decode(Context context, String ref) throws IOException {
        File file = local(context, ref);
        Bitmap bitmap = BitmapFactory.decodeFile(file.getPath());
        if (bitmap == null) throw new IOException("invalid_image");
        int orientation = new ExifInterface(file).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.setScale(-1,1); break;
            case ExifInterface.ORIENTATION_ROTATE_180: matrix.setRotate(180); break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.setScale(1,-1); break;
            case ExifInterface.ORIENTATION_TRANSPOSE: matrix.setRotate(90); matrix.postScale(-1,1); break;
            case ExifInterface.ORIENTATION_ROTATE_90: matrix.setRotate(90); break;
            case ExifInterface.ORIENTATION_TRANSVERSE: matrix.setRotate(-90); matrix.postScale(-1,1); break;
            case ExifInterface.ORIENTATION_ROTATE_270: matrix.setRotate(-90); break;
            default: return bitmap;
        }
        Bitmap upright = Bitmap.createBitmap(bitmap,0,0,bitmap.getWidth(),bitmap.getHeight(),matrix,true);
        if (upright != bitmap) bitmap.recycle();
        return upright;
    }
    private static final class Kernel {
        final int[] start, count;
        final double[][] weights;
        Kernel(int input, int output) {
            start = new int[output]; count = new int[output]; weights = new double[output][];
            double scale = (double) input / output, support = Math.max(1, scale);
            for (int i=0;i<output;i++) {
                double center=(i+.5)*scale;
                int lo=Math.max(0,(int)(center-support+.5)), hi=Math.min(input,(int)(center+support+.5));
                start[i]=lo; count[i]=hi-lo; weights[i]=new double[hi-lo]; double total=0;
                for(int j=lo;j<hi;j++) { double w=Math.max(0,1-Math.abs((j-center+.5)/support)); weights[i][j-lo]=w; total+=w; }
                for(int j=0;j<count[i];j++) weights[i][j]/=total;
            }
        }
    }
    /** PIL bilinear Resize: scale-aware triangle, 22-bit fixed weights, uint8 between axes. */
    public static FloatBuffer pe(Bitmap bitmap) {
        int w=bitmap.getWidth(), h=bitmap.getHeight(), n=384;
        int[] pixels=new int[w*h]; bitmap.getPixels(pixels,0,w,0,0,w,h);
        Kernel x=new Kernel(w,n), y=new Kernel(h,n);
        byte[] horizontal=new byte[n*h*3];
        for(int row=0;row<h;row++) for(int col=0;col<n;col++) for(int c=0;c<3;c++) {
            long sum=1<<21;
            for(int j=0;j<x.count[col];j++) sum+=((pixels[row*w+x.start[col]+j]>>(16-8*c))&255)*(long)(int)(x.weights[col][j]*(1<<22)+.5);
            horizontal[(row*n+col)*3+c]=(byte)Math.max(0,Math.min(255,sum>>22));
        }
        float[] out=new float[3*n*n];
        for(int row=0;row<n;row++) for(int col=0;col<n;col++) for(int c=0;c<3;c++) {
            long sum=1<<21;
            for(int j=0;j<y.count[row];j++) sum+=(horizontal[((y.start[row]+j)*n+col)*3+c]&255)*(long)(int)(y.weights[row][j]*(1<<22)+.5);
            out[c*n*n+row*n+col]=((float)Math.max(0,Math.min(255,sum>>22))/255f-.5f)/.5f;
        }
        return FloatBuffer.wrap(out);
    }
    /** torchvision tensor bilinear antialias: interpolation remains floating point. */
    public static FloatBuffer edge(Bitmap bitmap) {
        int w=bitmap.getWidth(),h=bitmap.getHeight(),n=1024;
        int[] pixels=new int[w*h]; bitmap.getPixels(pixels,0,w,0,0,w,h);
        Kernel x=new Kernel(w,n),y=new Kernel(h,n);
        float[] horizontal=new float[n*h*3],out=new float[3*n*n];
        float[] mean={.485f,.456f,.406f},std={.229f,.224f,.225f};
        for(int row=0;row<h;row++) for(int col=0;col<n;col++) for(int c=0;c<3;c++) {
            float sum=0;
            for(int j=0;j<x.count[col];j++) sum+=(((pixels[row*w+x.start[col]+j]>>(16-8*c))&255)/255f)*(float)x.weights[col][j];
            horizontal[(row*n+col)*3+c]=sum;
        }
        for(int row=0;row<n;row++) for(int col=0;col<n;col++) for(int c=0;c<3;c++) {
            float sum=0;
            for(int j=0;j<y.count[row];j++) sum+=horizontal[((y.start[row]+j)*n+col)*3+c]*(float)y.weights[row][j];
            out[c*n*n+row*n+col]=(sum-mean[c])/std[c];
        }
        return FloatBuffer.wrap(out);
    }
    public static File temp(Context context, String prefix) throws IOException {
        File dir=new File(context.getCacheDir(),"ml");
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("io_error");
        return File.createTempFile(prefix,".png",dir);
    }
    public static void png(Bitmap bitmap, File file) throws IOException {
        bitmap.setHasAlpha(false);
        try(OutputStream out=new FileOutputStream(file)) { if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,out)) throw new IOException("io_error"); }
    }
    /** Explicit PNG color type 0; Android Bitmap.compress emits RGB(A), not grayscale. */
    public static void maskPng(byte[] pixels,int w,int h,File file) throws IOException {
        try(DataOutputStream out=new DataOutputStream(new FileOutputStream(file))) {
            out.writeLong(0x89504e470d0a1a0aL);
            ByteArrayOutputStream header=new ByteArrayOutputStream();
            try(DataOutputStream d=new DataOutputStream(header)) { d.writeInt(w);d.writeInt(h);d.write(new byte[]{8,0,0,0,0}); }
            chunk(out,"IHDR",header.toByteArray());
            ByteArrayOutputStream encoded=new ByteArrayOutputStream();
            try(DeflaterOutputStream z=new DeflaterOutputStream(encoded)) { for(int row=0;row<h;row++){ z.write(0); z.write(pixels,row*w,w); } }
            chunk(out,"IDAT",encoded.toByteArray());chunk(out,"IEND",new byte[0]);
        }
    }
    private static void chunk(DataOutputStream out,String type,byte[] data) throws IOException {
        byte[] tag=type.getBytes(java.nio.charset.StandardCharsets.US_ASCII);
        CRC32 crc=new CRC32();crc.update(tag);crc.update(data);
        out.writeInt(data.length);out.write(tag);out.write(data);out.writeInt((int)crc.getValue());
    }
}
