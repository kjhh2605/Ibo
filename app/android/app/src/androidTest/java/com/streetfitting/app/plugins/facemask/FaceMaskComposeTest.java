package com.streetfitting.app.plugins.facemask;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.MlProof;
import com.streetfitting.app.plugins.segmenter.model.*;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class FaceMaskComposeTest {
    private HeadGeometry geometry()throws Exception {
        byte[] person=new byte[80000];for(int y=30;y<390;y++){int half=y<90?35:y<110?15:70;for(int x=100-half;x<=100+half;x++)person[y*200+x]=(byte)255;}
        return HeadGeometry.detect(person,200,400,HeadGeometry.DEFAULT);
    }
    @Test public void measuresBeforeCompositingAndPreservesProviderBytes()throws Exception {
        HeadGeometry g=geometry();Bitmap source=Bitmap.createBitmap(200,400,Bitmap.Config.ARGB_8888),provider=Bitmap.createBitmap(200,400,Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff808080);provider.eraseColor(0xff808080);File originalProvider=Images.temp(MlProof.context(),"provider-");Images.png(provider,originalProvider);String before=Models.hash(originalProvider);
        try {
            BoundaryMetrics uncalibrated=BoundaryMetrics.measure(source,g,provider,g,0,null);
            assertEquals("not_calibrated",uncalibrated.decision);assertFalse(uncalibrated.passed);
            assertEquals(0,uncalibrated.neckOffsetRatio95,1e-12);assertEquals(0,uncalibrated.shoulderOffsetRatio95,1e-12);
            assertEquals(0,uncalibrated.neckColorDeltaE95,1e-12);assertEquals(0,uncalibrated.shoulderColorDeltaE95,1e-12);
            BoundaryMetrics exact=BoundaryMetrics.measure(source,g,provider,g,0,new BoundaryMetrics.Thresholds("synthetic-test-only",0,0));assertTrue(exact.passed);
            provider.eraseColor(0xffeeeeee);
            BoundaryMetrics exceeded=BoundaryMetrics.measure(source,g,provider,g,0,new BoundaryMetrics.Thresholds("synthetic-test-only",0,0));assertFalse(exceeded.passed);assertEquals("threshold_exceeded",exceeded.decision);
            Bitmap composed=FaceMaskCore.compose(source,g,provider,0),faceless=Bitmap.createBitmap(provider,0,g.headBottom+1,200,400-g.headBottom-1);
            try {
                assertEquals(0xff808080,composed.getPixel(100,40));assertEquals(400-g.headBottom-1,faceless.getHeight());
                File output=Images.temp(MlProof.context(),"faceless-");try{Images.png(faceless,output);assertNotEquals(originalProvider.getCanonicalPath(),output.getCanonicalPath());assertEquals(before,Models.hash(originalProvider));}finally{output.delete();}
            } finally {composed.recycle();faceless.recycle();}
            MlProof.report("face-mask-compose",new JSONObject().put("measurementFixture","synthetic uniform surfaces, test thresholds only").put("uncalibrated",FaceMaskPlugin.metrics(uncalibrated)).put("inclusive",FaceMaskPlugin.metrics(exact)).put("exceeded",FaceMaskPlugin.metrics(exceeded)).put("providerImmutable",before.equals(Models.hash(originalProvider))));
        } finally {source.recycle();provider.recycle();originalProvider.delete();}
    }
}
