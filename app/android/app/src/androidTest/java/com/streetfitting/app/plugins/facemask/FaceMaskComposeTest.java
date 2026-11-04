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
    private HeadGeometry scaledGeometry(int shift)throws Exception {
        byte[] person=new byte[400*800];
        for(int y=80;y<780;y++){int half=y<160?60:y<190?30:140;for(int x=200+shift-half;x<=200+shift+half;x++)person[y*400+x]=(byte)255;}
        return HeadGeometry.detect(person,400,800,HeadGeometry.DEFAULT);
    }
    @Test public void scaledCoverageRejectsExactlyNextProviderPixel()throws Exception {
        HeadGeometry source=geometry(),generated=scaledGeometry(0);
        assertTrue(FaceMaskCore.compositionEligible(source,generated,400,800,0));
        int lastCoveredShift=(int)Math.floor((source.headRight+.5)*2-.5-generated.headRight);
        assertTrue(lastCoveredShift>=0);
        HeadGeometry covered=scaledGeometry(lastCoveredShift),uncovered=scaledGeometry(lastCoveredShift+1);
        assertTrue(FaceMaskCore.compositionEligible(source,covered,400,800,0));
        assertFalse(FaceMaskCore.compositionEligible(source,uncovered,400,800,0));
        assertFalse(FaceMaskCore.compositionEligible(source,covered,400,800,1));
        Bitmap original=Bitmap.createBitmap(200,400,Bitmap.Config.ARGB_8888),provider=Bitmap.createBitmap(400,800,Bitmap.Config.ARGB_8888);
        original.eraseColor(0xff123456);provider.eraseColor(0xffeeeeee);
        try {
            Bitmap restored=FaceMaskCore.compose(original,source,provider,covered,0);
            try {assertEquals(0xff123456,restored.getPixel(covered.headRight,covered.headTop));}finally{restored.recycle();}
            BoundaryMetrics rejected=BoundaryMetrics.measure(original,source,provider,uncovered,0,new BoundaryMetrics.Thresholds("geometry-unit-only",1000,1));
            assertEquals("metrics_unavailable",rejected.decision);assertFalse(rejected.passed);
        } finally {original.recycle();provider.recycle();}
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
            Bitmap composed=FaceMaskCore.compose(source,g,provider,g,0),faceless=Bitmap.createBitmap(provider,0,g.headBottom+1,200,400-g.headBottom-1);
            try {
                assertEquals(0xff808080,composed.getPixel(100,40));assertEquals(400-g.headBottom-1,faceless.getHeight());
                assertEquals(0xff808080,composed.getPixel(g.headLeft,g.headTop));
                BoundaryMetrics cropped=BoundaryMetrics.measure(source,g,provider,g,g.headBottom+1,new BoundaryMetrics.Thresholds("synthetic-test-only",1000,1));
                assertFalse(cropped.passed);assertEquals("metrics_unavailable",cropped.decision);
                try{FaceMaskCore.compose(source,g,provider,g,g.headBottom+1);fail("crop must not claim restored head");}catch(IllegalArgumentException expected){assertEquals("unsafe_output",expected.getMessage());}
                File output=Images.temp(MlProof.context(),"faceless-");try{Images.png(faceless,output);assertNotEquals(originalProvider.getCanonicalPath(),output.getCanonicalPath());assertEquals(before,Models.hash(originalProvider));}finally{output.delete();}
            } finally {composed.recycle();faceless.recycle();}
            MlProof.report("face-mask-compose",new JSONObject().put("measurementFixture","synthetic uniform surfaces, test thresholds only").put("uncalibrated",FaceMaskPlugin.metrics(uncalibrated)).put("inclusive",FaceMaskPlugin.metrics(exact)).put("exceeded",FaceMaskPlugin.metrics(exceeded)).put("providerImmutable",before.equals(Models.hash(originalProvider))));
        } finally {source.recycle();provider.recycle();originalProvider.delete();}
    }
    @Test public void provisionalSourceAndReleaseGatesPreserveLocalFilesAndSafety()throws Exception {
        HeadGeometry g=geometry();Bitmap source=Bitmap.createBitmap(200,400,Bitmap.Config.ARGB_8888),other=Bitmap.createBitmap(200,400,Bitmap.Config.ARGB_8888);
        source.eraseColor(0xff808080);other.eraseColor(0xffeeeeee);
        File stored=Images.temp(MlProof.context(),"stored-self-"),different=Images.temp(MlProof.context(),"other-self-"),savedResult=Images.temp(MlProof.context(),"existing-result-");
        try {
            Images.png(source,stored);Images.png(other,different);Images.png(source,savedResult);
            String sourceHash=Models.hash(stored),differentHash=Models.hash(different),resultHash=Models.hash(savedResult);
            BoundaryMetrics values=BoundaryMetrics.measure(source,g,source,g,0,null);
            BoundaryMetrics.Thresholds measured=new BoundaryMetrics.Thresholds("provisional-unit-only",Math.max(values.neckColorDeltaE95,values.shoulderColorDeltaE95),Math.max(values.neckOffsetRatio95,values.shoulderOffsetRatio95));
            HeadGeometry.Config config=new HeadGeometry.Config("a",measured,"local-composition-provisional-unit-only",sourceHash);
            assertTrue(BoundaryMetrics.measure(source,g,source,g,0,config.thresholdsForSource(Models.hash(stored),true)).passed);
            for(BoundaryMetrics.Thresholds blocked:new BoundaryMetrics.Thresholds[]{config.thresholdsForSource(Models.hash(different),true),config.thresholdsForSource(sourceHash,false)}) {
                assertNull(blocked);
                BoundaryMetrics result=BoundaryMetrics.measure(source,g,source,g,0,blocked);
                assertFalse(result.passed);assertEquals("not_calibrated",result.decision);assertNull(result.thresholdVersion);
                Bitmap faceless=Bitmap.createBitmap(source,0,g.headBottom+1,200,400-g.headBottom-1);
                try {assertEquals(400-g.headBottom-1,faceless.getHeight());}finally{faceless.recycle();}
            }
            // Matching provenance cannot bypass crop/geometry coverage rejection.
            BoundaryMetrics cropped=BoundaryMetrics.measure(source,g,source,g,g.headBottom+1,config.thresholdsForSource(sourceHash,true));
            assertFalse(cropped.passed);assertEquals("metrics_unavailable",cropped.decision);
            assertEquals(sourceHash,Models.hash(stored));assertEquals(differentHash,Models.hash(different));assertEquals(resultHash,Models.hash(savedResult));
        } finally {source.recycle();other.recycle();stored.delete();different.delete();savedResult.delete();}
    }
}
