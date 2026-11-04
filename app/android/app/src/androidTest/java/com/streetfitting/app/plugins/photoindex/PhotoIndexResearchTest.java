package com.streetfitting.app.plugins.photoindex;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.MlProof;
import com.streetfitting.app.plugins.segmenter.model.*;
import java.nio.*;
import java.nio.file.Files;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PhotoIndexResearchTest {
    @Test public void frozenResearch22Images7Queries()throws Exception {research(false);}
    @Test public void originalJpeg22Images7Queries()throws Exception {research(true);}
    private void research(boolean originalSource)throws Exception {
        JSONObject fixture=MlProof.json("research.json");JSONArray rows=fixture.getJSONArray("images"),queries=fixture.getJSONArray("queries");
        assertEquals(22,rows.length());assertEquals(7,queries.length());
        float[][] vectors=new float[22][];JSONArray comparisons=new JSONArray();boolean compatible=true;
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.getJSONObject(i);
            String input=row.getString(originalSource?"source":"canonical");
            assertEquals("Frozen input hash",row.getString(originalSource?"sourceSha256":"canonicalSha256"),Models.hash(MlProof.file(input)));
            Bitmap image=Images.decode(MlProof.context(),MlProof.file(input).toURI().toString());
            try{vectors[i]=PhotoIndexPlugin.infer(MlProof.context(),image);}finally{image.recycle();}
            float[] reference=MlProof.floats(row.getString("vector"));double max=0,dot=0,norm=0,refNorm=0;
            assertEquals(512,reference.length);assertEquals(512,vectors[i].length);
            for(int j=0;j<512;j++){max=Math.max(max,Math.abs(vectors[i][j]-reference[j]));dot+=vectors[i][j]*(double)reference[j];norm+=vectors[i][j]*(double)vectors[i][j];refNorm+=reference[j]*(double)reference[j];}
            double cosine=dot/Math.sqrt(norm*refNorm),error=Math.abs(Math.sqrt(norm)-1);boolean passed=max<=1e-4&&cosine>=.9999&&error<=1e-4;compatible&=passed;
            comparisons.put(new JSONObject().put("id",row.getString("id")).put("inputSha256",row.getString(originalSource?"sourceSha256":"canonicalSha256")).put("maxAbs",max).put("cosine",cosine).put("l2Error",error).put("passed",passed));
        }
        int hit1=0,hit3=0;JSONArray rankings=new JSONArray();
        for(int q=0;q<queries.length();q++) {
            JSONObject query=queries.getJSONObject(q);float[] text=MlProof.floats(query.getString("vector"));double[] scores=new double[22];List<Integer> order=new ArrayList<>();
            assertEquals(512,text.length);
            for(int i=0;i<22;i++){order.add(i);for(int j=0;j<512;j++)scores[i]+=vectors[i][j]*(double)text[j];}
            order.sort((a,b)->{int c=Double.compare(scores[b],scores[a]);return c!=0?c:Integer.compare(a,b);});
            Set<String> relevant=new HashSet<>();JSONArray truth=query.getJSONArray("relevant_ids");for(int i=0;i<truth.length();i++)relevant.add(truth.getString(i));
            JSONArray top=new JSONArray();boolean any=false;
            for(int i=0;i<3;i++){int index=order.get(i);String id=rows.getJSONObject(index).getString("id");top.put(new JSONObject().put("id",id).put("score",scores[index]));if(relevant.contains(id)){any=true;if(i==0)hit1++;}}
            if(any)hit3++;rankings.put(new JSONObject().put("query",query.getString("query")).put("top3",top));
        }
        String reportName=originalSource?"photo-index-original-jpeg":"photo-index-research";
        MlProof.report(reportName,new JSONObject().put("vectorComparisons",comparisons).put("rankings",rankings).put("hit1",hit1).put("hit3",hit3).put("inputDecode",originalSource?"Android original JPEG with production EXIF normalization":"Pillow RGB lossless PNG with production Android decode"));
        ByteBuffer output=ByteBuffer.allocate(22*512*4).order(ByteOrder.LITTLE_ENDIAN);
        for(float[] vector:vectors)for(float value:vector)output.putFloat(value);
        Files.write(MlProof.file("results/"+reportName+".f32").toPath(),output.array());
        assertTrue("Every source-faithful image vector meets fixed tolerance",compatible);assertEquals(7,hit3);assertEquals(6,hit1);
    }
}
