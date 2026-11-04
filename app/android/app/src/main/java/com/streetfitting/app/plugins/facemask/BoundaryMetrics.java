package com.streetfitting.app.plugins.facemask;

import android.graphics.Bitmap;
import java.util.*;

/** Pre-composition measurements; thresholds are absent until an independently recorded calibration. */
public final class BoundaryMetrics {
    public static final class Thresholds {
        public final String version;
        public final double maxBoundaryColorDeltaE,maxBoundaryOffsetRatio;
        public Thresholds(String version,double color,double offset) {
            if(version==null||version.isEmpty()||!valid(color)||!valid(offset))throw new IllegalArgumentException("invalid_argument");
            this.version=version;maxBoundaryColorDeltaE=color;maxBoundaryOffsetRatio=offset;
        }
    }
    public final Double neckColorDeltaE95,shoulderColorDeltaE95,neckOffsetRatio95,shoulderOffsetRatio95;
    public final String thresholdVersion,decision;
    public final boolean passed;
    public BoundaryMetrics(Double neckColor,Double shoulderColor,Double neckOffset,Double shoulderOffset,Thresholds thresholds) {
        neckColorDeltaE95=clean(neckColor);shoulderColorDeltaE95=clean(shoulderColor);neckOffsetRatio95=clean(neckOffset);shoulderOffsetRatio95=clean(shoulderOffset);
        thresholdVersion=thresholds==null?null:thresholds.version;
        if(thresholds==null)decision="not_calibrated";
        else if(neckColorDeltaE95==null||shoulderColorDeltaE95==null||neckOffsetRatio95==null||shoulderOffsetRatio95==null)decision="metrics_unavailable";
        else if(neckColorDeltaE95>thresholds.maxBoundaryColorDeltaE||shoulderColorDeltaE95>thresholds.maxBoundaryColorDeltaE||neckOffsetRatio95>thresholds.maxBoundaryOffsetRatio||shoulderOffsetRatio95>thresholds.maxBoundaryOffsetRatio)decision="threshold_exceeded";
        else decision="composited";
        passed="composited".equals(decision);
    }
    private static boolean valid(double value){return Double.isFinite(value)&&value>=0;}
    private static Double clean(Double value){return value!=null&&valid(value)?value:null;}
    private static final class Point {
        final double x,y,nx,ny;
        Point(double x,double y,double nx,double ny){this.x=x;this.y=y;this.nx=nx;this.ny=ny;}
    }
    public static BoundaryMetrics measure(Bitmap original,HeadGeometry source,Bitmap provider,HeadGeometry output,int cropOffset,Thresholds thresholds) {
        if(!FaceMaskCore.compositionEligible(source,output,provider.getWidth(),provider.getHeight(),cropOffset))return new BoundaryMetrics(null,null,null,null,thresholds);
        List<Point> sourceNeck=boundary(source,false,1,1,0),sourceShoulder=boundary(source,true,1,1,0);
        double sx=(double)source.w/output.w,sy=(double)(source.h-cropOffset)/output.h;
        List<Point> outputNeck=boundary(output,false,sx,sy,cropOffset),outputShoulder=boundary(output,true,sx,sy,cropOffset);
        double diagonal=Math.hypot(source.w,source.h);
        return new BoundaryMetrics(color(original,provider,sourceNeck,sx,sy,cropOffset),color(original,provider,sourceShoulder,sx,sy,cropOffset),offset(sourceNeck,outputNeck,diagonal),offset(sourceShoulder,outputShoulder,diagonal),thresholds);
    }
    private static List<Point> boundary(HeadGeometry g,boolean shoulder,double sx,double sy,int offset) {
        List<List<Point>> parts=new ArrayList<>();
        if(!shoulder) {
            if(g.rowRight[g.neck]<g.rowLeft[g.neck])return Collections.emptyList();
            parts.add(Arrays.asList(new Point(g.rowLeft[g.neck]*sx,g.neck*sy+offset,0,1),new Point(g.rowRight[g.neck]*sx,g.neck*sy+offset,0,1)));
        } else {
            int height=g.bottom-g.top+1,start=(int)Math.ceil(g.neck+.04*height),end=(int)Math.floor(g.neck+.15*height);
            if(end<=start||end>=g.h)return Collections.emptyList();
            for(int side=0;side<2;side++) {
                List<Point> line=new ArrayList<>();
                for(int y=start;y<=end;y++) {
                    if(g.rowRight[y]<g.rowLeft[y])return Collections.emptyList();
                    int prev=Math.max(start,y-1),next=Math.min(end,y+1);
                    double x=(side==0?g.rowLeft[y]:g.rowRight[y])*sx;
                    double dx=((side==0?g.rowLeft[next]:g.rowRight[next])-(side==0?g.rowLeft[prev]:g.rowRight[prev]))*sx,dy=(next-prev)*sy;
                    double length=Math.hypot(dx,dy),sign=side==0?-1:1;
                    line.add(new Point(x,y*sy+offset,sign*dy/length,-sign*dx/length));
                }
                parts.add(line);
            }
        }
        double total=0;for(List<Point> line:parts)for(int i=1;i<line.size();i++)total+=distance(line.get(i-1),line.get(i));
        if(!(total>0))return Collections.emptyList();
        List<Point> sampled=new ArrayList<>(64);
        for(int sample=0;sample<64;sample++) {
            double target=total*(sample+.5)/64,acc=0;Point chosen=null;
            outer:for(List<Point> line:parts)for(int i=1;i<line.size();i++) {
                Point a=line.get(i-1),b=line.get(i);double length=distance(a,b);
                if(acc+length>=target&&length>0){double t=(target-acc)/length,nx=a.nx*(1-t)+b.nx*t,ny=a.ny*(1-t)+b.ny*t,norm=Math.hypot(nx,ny);chosen=new Point(a.x*(1-t)+b.x*t,a.y*(1-t)+b.y*t,nx/norm,ny/norm);break outer;}acc+=length;
            }
            if(chosen==null)return Collections.emptyList();sampled.add(chosen);
        }
        return sampled;
    }
    private static double distance(Point a,Point b){return Math.hypot(a.x-b.x,a.y-b.y);}
    private static Double offset(List<Point> a,List<Point> b,double diagonal) {
        if(a.size()!=64||b.size()!=64)return null;
        double[] distances=new double[128];int i=0;
        for(Point p:a){double best=Double.POSITIVE_INFINITY;for(Point q:b)best=Math.min(best,distance(p,q));distances[i++]=best/diagonal;}
        for(Point p:b){double best=Double.POSITIVE_INFINITY;for(Point q:a)best=Math.min(best,distance(p,q));distances[i++]=best/diagonal;}
        return percentile(distances);
    }
    private static Double color(Bitmap original,Bitmap provider,List<Point> points,double sx,double sy,int offset) {
        if(points.size()!=64)return null;
        double[] differences=new double[64];int index=0;
        for(Point p:points) {
            double[] before=band(original,p,-1,1,1,0),after=band(provider,p,1,sx,sy,offset);
            if(before==null||after==null)return null;
            double[] a=lab(before),b=lab(after);differences[index++]=Math.sqrt(square(a[0]-b[0])+square(a[1]-b[1])+square(a[2]-b[2]));
        }
        return percentile(differences);
    }
    private static double[] band(Bitmap bitmap,Point p,int sign,double sx,double sy,int offset) {
        int[][] channels=new int[3][3];
        for(int d=1;d<=3;d++) {
            int x=(int)Math.round((p.x+sign*p.nx*d)/sx),y=(int)Math.round((p.y+sign*p.ny*d-offset)/sy);
            if(x<0||y<0||x>=bitmap.getWidth()||y>=bitmap.getHeight())return null;
            int rgb=bitmap.getPixel(x,y);for(int c=0;c<3;c++)channels[c][d-1]=(rgb>>(16-8*c))&255;
        }
        double[] median=new double[3];for(int c=0;c<3;c++){Arrays.sort(channels[c]);median[c]=channels[c][1]/255.0;}return median;
    }
    private static double square(double n){return n*n;}
    private static double linear(double v){return v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4);}
    private static double f(double v){return v>216.0/24389?Math.cbrt(v):(24389.0/27*v+16)/116;}
    private static double[] lab(double[] rgb) {
        double r=linear(rgb[0]),g=linear(rgb[1]),b=linear(rgb[2]);
        double x=f((.4124564*r+.3575761*g+.1804375*b)/.95047),y=f(.2126729*r+.7151522*g+.072175*b),z=f((.0193339*r+.119192*g+.9503041*b)/1.08883);
        return new double[]{116*y-16,500*(x-y),200*(y-z)};
    }
    private static double percentile(double[] values){Arrays.sort(values);double i=.95*(values.length-1);int lo=(int)i,hi=(int)Math.ceil(i);return values[lo]+(values[hi]-values[lo])*(i-lo);}
}
