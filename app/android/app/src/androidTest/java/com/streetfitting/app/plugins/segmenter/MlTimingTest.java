package com.streetfitting.app.plugins.segmenter;

import android.graphics.Bitmap;
import android.os.Debug;
import ai.onnxruntime.*;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.model.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.nio.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class MlTimingTest {
    private interface Timed {void run()throws Exception;}
    private JSONObject measure(Timed run)throws Exception {
        run.run();double[] ms=new double[5];JSONArray samples=new JSONArray();long peak=0;
        for(int i=0;i<5;i++){long start=System.nanoTime();run.run();ms[i]=(System.nanoTime()-start)/1e6;samples.put(ms[i]);Runtime r=Runtime.getRuntime();peak=Math.max(peak,r.totalMemory()-r.freeMemory()+Debug.getNativeHeapAllocatedSize());}
        Arrays.sort(ms);return new JSONObject().put("warmup",1).put("samplesMs",samples).put("medianMs",ms[2]).put("observedJavaPlusNativeHeapPeakBytes",peak);
    }
    @Test public void actualAarCpuInferenceTiming()throws Exception {
        long started=System.nanoTime();OrtSession encoder=Models.session(MlProof.context(),0),decoder=Models.session(MlProof.context(),1),pe=Models.session(MlProof.context(),2);double load=(System.nanoTime()-started)/1e6;
        Bitmap bitmap=MlProof.image("rack_input.png");JSONObject report=new JSONObject().put("sessionLoadMs",load).put("loadIsColdOnlyWhenFirstClassInFreshInstrumentation",true).put("bridgeAndDisplay","not exercised by direct native timing; end-to-end bridge scenario recorded separately");
        try(OnnxTensor image=OnnxTensor.createTensor(Models.ENV,Images.edge(bitmap),new long[]{1,3,1024,1024});OnnxTensor peImage=OnnxTensor.createTensor(Models.ENV,Images.pe(bitmap),new long[]{1,3,384,384});OnnxTensor coords=OnnxTensor.createTensor(Models.ENV,FloatBuffer.wrap(new float[]{.31f*1024,.68f*1024}),new long[]{1,1,2});OnnxTensor labels=OnnxTensor.createTensor(Models.ENV,LongBuffer.wrap(new long[]{1}),new long[]{1,1})) {
            Map<String,OnnxTensor> imageFeed=Collections.singletonMap("image",image);
            report.put("encoder",measure(()->{try(OrtSession.Result result=encoder.run(imageFeed)){assertEquals(3,result.size());}}));
            try(OrtSession.Result features=encoder.run(imageFeed)) {
                Map<String,OnnxTensor> feed=new HashMap<>();for(String key:new String[]{"embedding","high0","high1"})feed.put(key,(OnnxTensor)features.get(key).get());feed.put("coords",coords);feed.put("labels",labels);
                report.put("decoder",measure(()->{try(OrtSession.Result result=decoder.run(feed)){assertEquals(2,result.size());}}));
            }
            report.put("peImage",measure(()->{try(OrtSession.Result result=pe.run(Collections.singletonMap("image",peImage))){assertEquals(512,((OnnxTensor)result.get(0)).getFloatBuffer().remaining());}}));
        } finally {bitmap.recycle();}
        MlProof.report("timing",report);
    }
}
