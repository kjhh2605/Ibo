package com.streetfitting.app.plugins.facemask;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class CompositionConfigTest {
    private JSONObject disabled()throws Exception {
        return new JSONObject("{\"schemaVersion\":1,\"configVersion\":\"local-composition-uncalibrated-v1\",\"mode\":\"a\",\"compositionThresholds\":null,\"provenance\":null}");
    }
    private JSONObject provisional()throws Exception {
        String evidence="b".repeat(64);
        return disabled().put("configVersion","local-composition-provisional-"+evidence)
            .put("compositionThresholds",new JSONObject().put("version","provisional-"+evidence.substring(0,16)).put("maxBoundaryColorDeltaE",0).put("maxBoundaryOffsetRatio",0))
            .put("provenance",new JSONObject().put("kind","provisional-synthetic").put("sourceRun","parser-unit-only").put("evidenceSha256",evidence).put("sourceImageSha256","c".repeat(64)).put("providerSamples",2).put("humanApproved",false));
    }
    private void rejected(JSONObject value)throws Exception {
        try{CompositionConfig.parse(value);fail("invalid config enabled");}catch(IllegalArgumentException|org.json.JSONException expected){}
    }
    @Test public void invalidOrUnboundConfigCannotEnableComposition()throws Exception {
        rejected(disabled().put("schemaVersion",2));rejected(disabled().put("schemaVersion","1"));
        rejected(disabled().put("mode","b"));rejected(disabled().put("configVersion","stale"));
        rejected(disabled().put("debugThreshold",100));rejected(disabled().put("provenance",new JSONObject()));
        rejected(disabled().put("compositionThresholds",new JSONObject().put("version","not-calibration").put("maxBoundaryColorDeltaE",100).put("maxBoundaryOffsetRatio",1)));
    }
    @Test public void provisionalSchemaIsExplicitAndBoundToEvidence()throws Exception {
        HeadGeometry.Config config=CompositionConfig.parse(provisional());
        assertEquals("c".repeat(64),config.provisionalSourceImageSha256);
        assertSame(config.compositionThresholds,config.thresholdsForSource("c".repeat(64),true));
        assertNull(config.thresholdsForSource("c".repeat(64),false));
        assertNull(config.thresholdsForSource("d".repeat(64),true));
        assertNull(config.thresholdsForSource(null,true));
        rejected(provisional().put("configVersion","stale"));
        JSONObject wrongVersion=provisional();wrongVersion.getJSONObject("compositionThresholds").put("version","unbound");rejected(wrongVersion);
        for(Object count:new Object[]{0,-1,1.5,"2",9007199254740992d}) {
            JSONObject bad=provisional();bad.getJSONObject("provenance").put("providerSamples",count);rejected(bad);
        }
        for(Object approved:new Object[]{true,"false",JSONObject.NULL}) {
            JSONObject bad=provisional();bad.getJSONObject("provenance").put("humanApproved",approved);rejected(bad);
        }
        for(String source:new String[]{"","not-a-sha","C".repeat(64)}) {
            JSONObject bad=provisional();bad.getJSONObject("provenance").put("sourceImageSha256",source);rejected(bad);
        }
        JSONObject extra=provisional();extra.getJSONObject("provenance").put("humanReview",true);rejected(extra);
        JSONObject kind=provisional();kind.getJSONObject("provenance").put("kind","reviewed");rejected(kind);
    }
    @Test public void genuineReviewedSchemaStillWorksInProduction()throws Exception {
        String hash="a".repeat(64);
        JSONObject proof=new JSONObject().put("sourceRun","parser-unit-only").put("completionRun","parser-unit-only")
            .put("providerCalls",16).put("frozenBeforeCall",13).put("heldOutReplayed",2).put("humanApproved",true);
        for(String key:new String[]{"planSha256","callsSha256","evidenceSha256","calibrationReviewSha256","finalHumanReviewSha256"})proof.put(key,hash);
        JSONObject value=disabled().put("configVersion","local-composition-"+hash).put("provenance",proof)
            .put("compositionThresholds",new JSONObject().put("version","parser-unit-only").put("maxBoundaryColorDeltaE",0).put("maxBoundaryOffsetRatio",0));
        HeadGeometry.Config config=CompositionConfig.parse(value);
        assertNull(config.provisionalSourceImageSha256);
        assertSame(config.compositionThresholds,config.thresholdsForSource(null,false));
        proof.put("humanApproved",false);rejected(value);
    }
}
