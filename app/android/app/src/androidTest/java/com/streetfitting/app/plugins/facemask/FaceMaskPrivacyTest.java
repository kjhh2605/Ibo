package com.streetfitting.app.plugins.facemask;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.MlProof;
import com.streetfitting.app.plugins.segmenter.model.Images;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import java.io.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FaceMaskPrivacyTest {
    @Test public void protectedPixelsCannotContributeInAnyMode()throws Exception {
        int w=200,h=400;byte[] silhouette=new byte[w*h];int[] color=new int[w*h];
        for(int y=0;y<h;y++)for(int x=0;x<w;x++){color[y*w+x]=0xff000000|((x*37+y*13)&0xffffff);if(y>=30&&y<390){int half=y<90?35:y<110?15:70;if(Math.abs(x-100)<=half)silhouette[y*w+x]=(byte)255;}}
        HeadGeometry geometry=HeadGeometry.detect(silhouette,w,h,HeadGeometry.DEFAULT);
        Bitmap original=Bitmap.createBitmap(color,w,h,Bitmap.Config.ARGB_8888),gt=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);gt.eraseColor(0xff000000);
        for(int y=30;y<90;y++)for(int x=65;x<=135;x++)gt.setPixel(x,y,0xffffffff);
        try {
            for(String mode:new String[]{"a","b","c"}) {
                Bitmap masked=FaceMaskCore.mask(original,geometry,mode);File file=Images.temp(MlProof.context(),"protected-");Bitmap wire=FaceMaskCore.wire(masked,file);
                try {
                    long[] counts=FaceMaskCore.exposure(gt,geometry,mode,wire.getWidth(),wire.getHeight());assertEquals(4260,counts[0]);assertEquals(0,counts[1]);
                    if(!"b".equals(mode))for(int y=30;y<90;y++)for(int x=65;x<=135;x++)assertEquals(0xff7f7f7f,wire.getPixel(x,y));
                    assertNull(new androidx.exifinterface.media.ExifInterface(file).getAttribute(androidx.exifinterface.media.ExifInterface.TAG_GPS_LATITUDE));
                } finally {if(wire!=masked)wire.recycle();masked.recycle();file.delete();}
            }
        } finally {original.recycle();gt.recycle();}
    }
    @Test public void frozenSelfCorpusRequiresActualDetectionAndApprovedGroundTruth()throws Exception {
        JSONObject fixture=MlProof.json("self.json");JSONArray cases=fixture.getJSONArray("cases"),observed=new JSONArray();boolean detectionPassed=true,privacyPassed=true,allApproved=true;
        for(int i=0;i<cases.length();i++) {
            JSONObject row=cases.getJSONObject(i);Bitmap image=MlProof.image(row.getString("image"));HeadGeometry geometry=null;String reason=null;long[] counts=null;
            try {
                try{geometry=FaceMaskCore.detect(MlProof.context(),image,HeadGeometry.DEFAULT);}catch(HeadGeometry.Rejected e){reason=e.reason;}
                boolean expected=row.getBoolean("expectedPerson");boolean detected=geometry!=null;detectionPassed&=detected==expected;
                if(expected) {
                    if(!row.optBoolean("approvedGT",false)){allApproved=false;}
                    else if(geometry!=null) {
                        Bitmap gt=MlProof.image(row.getString("groundTruth")),masked=FaceMaskCore.mask(image,geometry,"a");File file=Images.temp(MlProof.context(),"fixture-");Bitmap wire=FaceMaskCore.wire(masked,file);
                        try{counts=FaceMaskCore.exposure(gt,geometry,"a",wire.getWidth(),wire.getHeight());privacyPassed&=counts[1]==0;}finally{gt.recycle();if(wire!=masked)wire.recycle();masked.recycle();file.delete();}
                    } else privacyPassed=false;
                }
                observed.put(new JSONObject().put("id",row.getString("id")).put("expectedPerson",expected).put("registrationOk",detected).put("reason",reason==null?JSONObject.NULL:reason).put("gtApproved",row.optBoolean("approvedGT",false)).put("exposedHeadPixels",counts==null?JSONObject.NULL:counts[1]));
            } finally {image.recycle();}
        }
        MlProof.report("face-mask-privacy",new JSONObject().put("cases",observed).put("detectionPassed",detectionPassed).put("allGTApproved",allApproved).put("privacyPassed",allApproved&&privacyPassed));
        assertTrue("Every frozen positive and negative must match intended registration outcome",detectionPassed);
        Assume.assumeTrue("Human-reviewed face+hair GT required; drafts cannot prove privacy",allApproved);
        assertTrue("Every accepted fixture must expose zero GT pixels",privacyPassed);
    }
}
