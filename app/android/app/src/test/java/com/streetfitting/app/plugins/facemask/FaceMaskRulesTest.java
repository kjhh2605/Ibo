package com.streetfitting.app.plugins.facemask;

import org.junit.Test;
import static org.junit.Assert.*;

public class FaceMaskRulesTest {
    private byte[] person() {
        byte[] mask=new byte[200*400];
        for(int y=30;y<390;y++) {
            int half=y<90?35:y<110?15:70;
            for(int x=100-half;x<=100+half;x++)mask[y*200+x]=(byte)255;
        }
        return mask;
    }
    @Test public void protectedHeadIncludesHairMarginAndOpaqueRectangle() throws Exception {
        HeadGeometry g=HeadGeometry.detect(person(),200,400,HeadGeometry.DEFAULT);
        assertTrue(g.headLeft<65);assertTrue(g.headRight>135);assertTrue(g.headTop<30);assertTrue(g.headBottom>g.neck);
        byte[] mask=g.headMask();
        for(int y=g.headTop;y<=g.headBottom;y++)for(int x=g.headLeft;x<=g.headRight;x++)assertEquals(255,mask[y*200+x]&255);
        assertFalse(g.protectedPixel(100,390,"a"));assertTrue(g.protectedPixel(0,g.headBottom,"b"));
    }
    @Test public void noPersonCannotPassUsingExpectedLabel() throws Exception {
        try{HeadGeometry.detect(new byte[80000],200,400,HeadGeometry.DEFAULT);fail();}catch(HeadGeometry.Rejected e){assertEquals("person_not_found",e.reason);}
    }
    @Test public void clippedHeadIsNotSafe() throws Exception {
        byte[] mask=person();for(int y=0;y<30;y++)for(int x=65;x<=135;x++)mask[y*200+x]=(byte)255;
        try{HeadGeometry.detect(mask,200,400,HeadGeometry.DEFAULT);fail();}catch(HeadGeometry.Rejected e){assertEquals("unsafe_boundary",e.reason);}
    }
    @Test public void composeThresholdInclusiveBoundary() {
        BoundaryMetrics m=new BoundaryMetrics(12.0,12.0,.02,.02,new BoundaryMetrics.Thresholds("test-only",12,.02));
        assertTrue(m.passed);assertEquals("composited",m.decision);
    }
    @Test public void oneMetricExceededIsFaceless() {
        BoundaryMetrics m=new BoundaryMetrics(12.00001,12.0,.02,.02,new BoundaryMetrics.Thresholds("test-only",12,.02));
        assertFalse(m.passed);assertEquals("threshold_exceeded",m.decision);
    }
    @Test public void nullThresholdsAreNotCalibrated() {
        BoundaryMetrics m=new BoundaryMetrics(null,null,null,null,null);assertFalse(m.passed);assertEquals("not_calibrated",m.decision);
    }
    @Test public void metricsUnavailableIsFaceless() {
        BoundaryMetrics m=new BoundaryMetrics(1.0,Double.NaN,.01,.01,new BoundaryMetrics.Thresholds("test-only",12,.02));
        assertFalse(m.passed);assertEquals("metrics_unavailable",m.decision);
    }
}
