package com.streetfitting.app.plugins.facemask;

import java.util.*;

/** Deterministic silhouette rules from device-modules §6; no biometric model or GT input. */
public final class HeadGeometry {
    public static final class Config {
        public final double minArea=.10, secondComponent=.25, minHeight=.45;
        public final double neckStart=.12,neckEnd=.38,headStart=.04,headEnd=.12,shoulderStart=.04,shoulderEnd=.15;
        public final double headNarrow=.85,shoulderNarrow=.75,centerTolerance=.20;
        public final double hairX=.08,hairY=.04,bottomMargin=.02,maxHeadArea=.40;
        public final int minMargin=8;
        public final String mode;
        public final BoundaryMetrics.Thresholds compositionThresholds;
        public Config() { this("a",null); }
        public Config(String mode,BoundaryMetrics.Thresholds thresholds) {
            if(!Set.of("a","b","c").contains(mode))throw new IllegalArgumentException("invalid_argument");
            this.mode=mode;this.compositionThresholds=thresholds;
        }
    }
    public static final Config DEFAULT=new Config();
    public final int w,h,left,top,right,bottom,neck,headLeft,headTop,headRight,headBottom;
    public final int[] rowLeft,rowRight;
    public final byte[] person;
    public static final class Rejected extends Exception {
        public final String reason;
        Rejected(String reason) { super(reason);this.reason=reason; }
    }
    private HeadGeometry(int w,int h,int left,int top,int right,int bottom,int neck,int hl,int ht,int hr,int hb,int[] rowLeft,int[] rowRight,byte[] person) {
        this.w=w;this.h=h;this.left=left;this.top=top;this.right=right;this.bottom=bottom;this.neck=neck;
        headLeft=hl;headTop=ht;headRight=hr;headBottom=hb;this.rowLeft=rowLeft;this.rowRight=rowRight;this.person=person;
    }
    public static HeadGeometry detect(byte[] mask,int w,int h,Config config) throws Rejected {
        if(mask.length!=w*h)throw new IllegalArgumentException("invalid_mask");
        int center=(h/2)*w+w/2;
        if(mask[center]==0)throw new Rejected("person_not_found");
        int[] labels=new int[mask.length],queue=new int[mask.length];
        int id=0,centerId=0;List<Integer> sizes=new ArrayList<>();sizes.add(0);
        // Four-connected components conservatively keep diagonally touching people separate.
        for(int seed=0;seed<mask.length;seed++) if(mask[seed]!=0&&labels[seed]==0) {
            ++id;int begin=0,end=1;queue[0]=seed;labels[seed]=id;
            while(begin<end) {
                int p=queue[begin++],x=p%w,y=p/w;
                if(p==center)centerId=id;
                if(x>0&&mask[p-1]!=0&&labels[p-1]==0){labels[p-1]=id;queue[end++]=p-1;}
                if(x+1<w&&mask[p+1]!=0&&labels[p+1]==0){labels[p+1]=id;queue[end++]=p+1;}
                if(y>0&&mask[p-w]!=0&&labels[p-w]==0){labels[p-w]=id;queue[end++]=p-w;}
                if(y+1<h&&mask[p+w]!=0&&labels[p+w]==0){labels[p+w]=id;queue[end++]=p+w;}
            }
            sizes.add(end);
        }
        int area=sizes.get(centerId);
        if(area<w*(double)h*config.minArea)throw new Rejected("person_not_found");
        for(int i=1;i<sizes.size();i++)if(i!=centerId&&sizes.get(i)>=area*config.secondComponent)throw new Rejected("ambiguous_person");
        byte[] person=new byte[mask.length];int[] lo=new int[h],hi=new int[h];Arrays.fill(lo,w);Arrays.fill(hi,-1);
        int left=w,right=-1,top=h,bottom=-1;
        for(int p=0;p<labels.length;p++)if(labels[p]==centerId) {
            int x=p%w,y=p/w;person[p]=(byte)255;lo[y]=Math.min(lo[y],x);hi[y]=Math.max(hi[y],x);
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        }
        int height=bottom-top+1,width=right-left+1;
        if(top<=1)throw new Rejected("unsafe_boundary");
        if(height<h*config.minHeight)throw new Rejected("person_not_found");
        double[] widths=new double[h];double[] window=new double[5];
        for(int row=top;row<=bottom;row++) {
            int count=0;for(int y=Math.max(top,row-2);y<=Math.min(bottom,row+2);y++)if(hi[y]>=lo[y])window[count++]=hi[y]-lo[y]+1;
            if(count==0)continue;Arrays.sort(window,0,count);widths[row]=count%2==1?window[count/2]:(window[count/2-1]+window[count/2])/2;
        }
        int neck=-1;double best=Double.POSITIVE_INFINITY;
        for(int y=(int)Math.ceil(top+config.neckStart*height);y<=Math.floor(top+config.neckEnd*height);y++) {
            if(widths[y]<=0)continue;
            int head=maxRow(widths,(int)Math.ceil(y-config.headEnd*height),(int)Math.floor(y-config.headStart*height),top,bottom);
            int shoulder=maxRow(widths,(int)Math.ceil(y+config.shoulderStart*height),(int)Math.floor(y+config.shoulderEnd*height),top,bottom);
            if(head<0||shoulder<0||hi[head]<lo[head]||hi[shoulder]<lo[shoulder])continue;
            if(widths[y]>config.headNarrow*widths[head]||widths[y]>config.shoulderNarrow*widths[shoulder])continue;
            if(Math.abs((lo[head]+hi[head]-lo[shoulder]-hi[shoulder])/2.0)>config.centerTolerance*width)continue;
            if(widths[y]<best){best=widths[y];neck=y;}
        }
        if(neck<0)throw new Rejected("head_not_found");
        int hl=w,hr=-1;
        for(int y=top;y<=neck;y++){hl=Math.min(hl,lo[y]);hr=Math.max(hr,hi[y]);}
        int mx=(int)Math.ceil(Math.max(config.minMargin,width*config.hairX)),my=(int)Math.ceil(Math.max(config.minMargin,height*config.hairY));
        hl-=mx;hr+=mx;int ht=top-my,hb=(int)Math.ceil(neck+height*config.bottomMargin);
        if(hl<0||hr>=w||ht<0||hb>=h||(hr-hl+1)*(double)(hb-ht+1)>w*(double)h*config.maxHeadArea)throw new Rejected("unsafe_boundary");
        return new HeadGeometry(w,h,left,top,right,bottom,neck,hl,ht,hr,hb,lo,hi,person);
    }
    private static int maxRow(double[] widths,int start,int end,int top,int bottom) {
        int best=-1;for(int y=Math.max(top,start);y<=Math.min(bottom,end);y++)if(widths[y]>0&&(best<0||widths[y]>widths[best]))best=y;return best;
    }
    public boolean protectedPixel(int x,int y,String mode) {
        if("b".equals(mode))return y<=headBottom;
        return x>=headLeft&&x<=headRight&&y>=headTop&&y<=headBottom || "c".equals(mode)&&person[y*w+x]==0;
    }
    public byte[] headMask() {
        byte[] pixels=new byte[w*h];for(int y=headTop;y<=headBottom;y++)Arrays.fill(pixels,y*w+headLeft,y*w+headRight+1,(byte)255);return pixels;
    }
    public double areaRatio() {return (headRight-headLeft+1)*(double)(headBottom-headTop+1)/(w*(double)h);}
}
