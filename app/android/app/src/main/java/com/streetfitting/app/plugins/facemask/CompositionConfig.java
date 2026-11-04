package com.streetfitting.app.plugins.facemask;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Loads the same checked-in local asset imported by the web build. Never downloads configuration. */
public final class CompositionConfig {
    private CompositionConfig() {}
    public static HeadGeometry.Config load(Context context) throws IOException {
        try(InputStream stream=context.getAssets().open("local-composition.json")) {
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int count;
            while((count=stream.read(buffer))!=-1)bytes.write(buffer,0,count);
            return parse(new JSONObject(bytes.toString(StandardCharsets.UTF_8.name())));
        } catch(Exception error) {throw new IOException("invalid_composition_config",error);}
    }
    private static void require(boolean valid) {if(!valid)throw new IllegalArgumentException("invalid_composition_config");}
    private static void keys(JSONObject value,String... names) {
        Set<String> actual=new HashSet<>();value.keys().forEachRemaining(actual::add);
        require(actual.equals(new HashSet<>(Arrays.asList(names))));
    }
    private static String text(JSONObject value,String key)throws JSONException {
        Object raw=value.get(key);require(raw instanceof String&&!((String)raw).trim().isEmpty());return (String)raw;
    }
    private static void integer(JSONObject value,String key,int expected)throws JSONException {
        Object raw=value.get(key);require(raw instanceof Number&&((Number)raw).doubleValue()==expected);
    }
    private static double finite(JSONObject value,String key)throws JSONException {
        Object raw=value.get(key);require(raw instanceof Number);double n=((Number)raw).doubleValue();require(Double.isFinite(n)&&n>=0);return n;
    }
    private static void positiveInteger(JSONObject value,String key)throws JSONException {
        Object raw=value.get(key);require(raw instanceof Number);double n=((Number)raw).doubleValue();
        require(Double.isFinite(n)&&n>0&&n<=9007199254740991d&&n==Math.floor(n));
    }
    public static HeadGeometry.Config parse(JSONObject value)throws JSONException {
        keys(value,"schemaVersion","configVersion","mode","compositionThresholds","provenance");
        integer(value,"schemaVersion",1);String version=text(value,"configVersion");require("a".equals(text(value,"mode")));
        if(value.isNull("compositionThresholds")) {
            require(value.isNull("provenance")&&"local-composition-uncalibrated-v1".equals(version));
            return new HeadGeometry.Config("a",null,version);
        }
        JSONObject t=value.getJSONObject("compositionThresholds"),p=value.getJSONObject("provenance");
        keys(t,"version","maxBoundaryColorDeltaE","maxBoundaryOffsetRatio");
        String thresholdVersion=text(t,"version");double color=finite(t,"maxBoundaryColorDeltaE"),offset=finite(t,"maxBoundaryOffsetRatio");
        if("provisional-synthetic".equals(p.opt("kind"))) {
            keys(p,"kind","sourceRun","evidenceSha256","sourceImageSha256","providerSamples","humanApproved");
            text(p,"sourceRun");positiveInteger(p,"providerSamples");require(Boolean.FALSE.equals(p.get("humanApproved")));
            String evidence=text(p,"evidenceSha256"),source=text(p,"sourceImageSha256");
            require(evidence.matches("[a-f0-9]{64}")&&source.matches("[a-f0-9]{64}"));
            require(version.equals("local-composition-provisional-"+evidence)&&thresholdVersion.equals("provisional-"+evidence.substring(0,16)));
            return new HeadGeometry.Config("a",new BoundaryMetrics.Thresholds(thresholdVersion,color,offset),version,source);
        }
        keys(p,"sourceRun","completionRun","planSha256","callsSha256","evidenceSha256","calibrationReviewSha256","finalHumanReviewSha256","providerCalls","frozenBeforeCall","heldOutReplayed","humanApproved");
        text(p,"sourceRun");text(p,"completionRun");integer(p,"providerCalls",16);integer(p,"frozenBeforeCall",13);integer(p,"heldOutReplayed",2);require(Boolean.TRUE.equals(p.get("humanApproved")));
        for(String key:new String[]{"planSha256","callsSha256","evidenceSha256","calibrationReviewSha256","finalHumanReviewSha256"})require(text(p,key).matches("[a-f0-9]{64}"));
        require(version.equals("local-composition-"+p.getString("evidenceSha256")));
        return new HeadGeometry.Config("a",new BoundaryMetrics.Thresholds(thresholdVersion,color,offset),version);
    }
}
