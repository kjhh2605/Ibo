package com.streetfitting.app.plugins.photoindex;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.MlProof;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PhotoIndexResearchTest {
    @Test public void frozenResearch22Images7Queries()throws Exception {
        JSONObject fixture=MlProof.json("research.json");JSONArray rows=fixture.getJSONArray("images"),queries=fixture.getJSONArray("queries");
        assertEquals(22,rows.length());assertEquals(7,queries.length());
        float[][] vectors=new float[22][];JSONArray comparisons=new JSONArray();boolean compatible=true;
        for(int i=0;i<rows.length();i++) {
            JSONObject row=rows.getJSONObject(i);Bitmap image=MlProof.image(row.getString("canonical"));
            try{vectors[i]=PhotoIndexPlugin.infer(MlProof.context(),image);}finally{image.recycle();}
            float[] reference=MlProof.floats(row.getString("vector"));double max=0,dot=0,norm=0,refNorm=0;
            for(int j=0;j<512;j++){max=Math.max(max,Math.abs(vectors[i][j]-reference[j]));dot+=vectors[i][j]*(double)reference[j];norm+=vectors[i][j]*(double)vectors[i][j];refNorm+=reference[j]*(double)reference[j];}
            double cosine=dot/Math.sqrt(norm*refNorm),error=Math.abs(Math.sqrt(norm)-1);boolean passed=max<=1e-4&&cosine>=.9999&&error<=1e-4;compatible&=passed;
            comparisons.put(new JSONObject().put("id",row.getString("id")).put("maxAbs",max).put("cosine",cosine).put("l2Error",error).put("passed",passed));
        }
        int hit1=0,hit3=0;JSONArray rankings=new JSONArray();
        for(int q=0;q<queries.length();q++) {
            JSONObject query=queries.getJSONObject(q);float[] text=MlProof.floats(query.getString("vector"));double[] scores=new double[22];List<Integer> order=new ArrayList<>();
            for(int i=0;i<22;i++){order.add(i);for(int j=0;j<512;j++)scores[i]+=vectors[i][j]*(double)text[j];}
            order.sort((a,b)->{int c=Double.compare(scores[b],scores[a]);return c!=0?c:Integer.compare(a,b);});
            Set<String> relevant=new HashSet<>();JSONArray truth=query.getJSONArray("relevant_ids");for(int i=0;i<truth.length();i++)relevant.add(truth.getString(i));
            JSONArray top=new JSONArray();boolean any=false;
            for(int i=0;i<3;i++){int index=order.get(i);String id=rows.getJSONObject(index).getString("id");top.put(new JSONObject().put("id",id).put("score",scores[index]));if(relevant.contains(id)){any=true;if(i==0)hit1++;}}
            if(any)hit3++;rankings.put(new JSONObject().put("query",query.getString("query")).put("top3",top));
        }
        MlProof.report("photo-index-research",new JSONObject().put("vectorComparisons",comparisons).put("rankings",rankings).put("hit1",hit1).put("hit3",hit3).put("canonicalization","Pillow RGB lossless PNG; source JPEG SHA256 retained in research.json"));
        assertTrue("Every source-faithful image vector meets fixed tolerance",compatible);assertEquals(7,hit3);assertEquals(6,hit1);
    }
}
