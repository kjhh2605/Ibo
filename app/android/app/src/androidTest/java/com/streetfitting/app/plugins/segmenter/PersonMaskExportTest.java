package com.streetfitting.app.plugins.segmenter;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.facemask.HeadGeometry;
import com.streetfitting.app.plugins.segmenter.model.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.nio.file.Files;
import java.util.List;
import static org.junit.Assert.*;

/** Local proof artifact only: inferred masks are never human head GT or privacy approval. */
@RunWith(AndroidJUnit4.class)
public class PersonMaskExportTest {
    @Test public void exportExactFixturePersonCandidates() throws Exception {
        JSONArray cases=MlProof.json("person-export.json").getJSONArray("cases"),observed=new JSONArray();
        assertTrue("Explicit self/provider fixture manifest required",cases.length()>0);
        File dir=MlProof.file("results/person-masks");
        if(!dir.isDirectory()&&!dir.mkdirs())throw new java.io.IOException("Cannot create local proof directory");
        EdgeEngine engine=EdgeEngine.SHARED;
        synchronized(engine) {
            try {
                for(int i=0;i<cases.length();i++) {
                    JSONObject row=cases.getJSONObject(i);String id=row.getString("id");
                    assertTrue("Fixture ID must be a local artifact basename",id.matches("[A-Za-z0-9_-]{1,200}"));
                    File source=MlProof.file(row.getString("image"));String digest=Models.hash(source);
                    assertEquals("Fixture bytes must match the coordinator manifest",row.getString("sha256"),digest);
                    Bitmap image=Images.decode(MlProof.context(),source.toURI().toString());
                    try {
                        int w=image.getWidth(),h=image.getHeight();
                        String handle=engine.prepare(MlProof.context(),image,source);
                        List<EdgeEngine.Mask> masks=engine.tap(MlProof.context(),handle,.5,.5);
                        assertEquals(3,masks.size());JSONArray exported=new JSONArray();
                        for(int rank=0;rank<3;rank++) {
                            EdgeEngine.Mask mask=masks.get(rank);
                            assertEquals(w*h,mask.pixels.length);
                            if(rank>0)assertTrue(masks.get(rank-1).score>=mask.score);
                            String basename=id+"-"+mask.decoderIndex;
                            File png=new File(dir,basename+".png"),binary=new File(dir,basename+".bin");
                            Images.maskPng(mask.pixels,w,h,png);Files.write(binary.toPath(),mask.pixels);
                            JSONObject candidate=new JSONObject().put("rank",rank).put("decoderIndex",mask.decoderIndex).put("score",mask.score)
                                .put("png","person-masks/"+png.getName()).put("binary","person-masks/"+binary.getName())
                                .put("pngSha256",Models.hash(png)).put("binarySha256",Models.hash(binary))
                                .put("bboxPixels",new JSONArray(new int[]{mask.left,mask.top,mask.right-mask.left+1,mask.bottom-mask.top+1}));
                            try {
                                HeadGeometry head=HeadGeometry.detect(mask.pixels,w,h,HeadGeometry.DEFAULT);
                                candidate.put("geometryAccepted",true).put("headBoxPixels",new JSONArray(new int[]{head.headLeft,head.headTop,head.headRight-head.headLeft+1,head.headBottom-head.headTop+1}));
                            } catch(HeadGeometry.Rejected rejected) {
                                candidate.put("geometryAccepted",false).put("geometryRejection",rejected.reason);
                            }
                            exported.put(candidate);
                        }
                        assertEquals("Inference must not mutate source bytes",digest,Models.hash(source));
                        observed.put(new JSONObject().put("id",id).put("sourceSha256",digest).put("w",w).put("h",h).put("masks",exported));
                        engine.release(handle);
                    } finally {image.recycle();}
                }
            } finally {engine.release();}
        }
        MlProof.report("person-mask-export",new JSONObject().put("humanGroundTruth",false).put("privacyApproval",false).put("point",new JSONArray(new double[]{.5,.5})).put("cases",observed));
    }
}
