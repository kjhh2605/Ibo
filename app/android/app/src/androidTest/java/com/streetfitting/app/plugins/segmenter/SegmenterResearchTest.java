package com.streetfitting.app.plugins.segmenter;

import android.graphics.Bitmap;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.streetfitting.app.plugins.segmenter.model.*;
import org.json.*;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class SegmenterResearchTest {
    @Test public void exactFrozenMasksAndCacheLifecycle()throws Exception {
        JSONObject fixtures=MlProof.json("research.json");JSONArray masks=fixtures.getJSONArray("segmentation"),results=new JSONArray();boolean exact=true;
        EdgeEngine engine=EdgeEngine.SHARED;
        synchronized(engine) {
            try {
                for(int i=0;i<masks.length();i++) {
                    JSONObject row=masks.getJSONObject(i);Bitmap image=MlProof.image(row.getString("image"));String handle;
                    try{handle=engine.prepare(MlProof.context(),image,null);}finally{image.recycle();}
                    List<EdgeEngine.Mask> actual=engine.tap(MlProof.context(),handle,row.getDouble("x"),row.getDouble("y"));
                    List<EdgeEngine.Mask> repeated=engine.tap(MlProof.context(),handle,row.getDouble("x"),row.getDouble("y"));
                    List<File> retained=new ArrayList<>();
                    for(int rank=0;rank<3;rank++) {
                        EdgeEngine.Mask m=actual.get(rank);assertArrayEquals(m.pixels,repeated.get(rank).pixels);
                        byte[] expected=Files.readAllBytes(MlProof.file(row.getJSONArray("masks").getString(m.decoderIndex)).toPath());
                        assertEquals(expected.length,m.pixels.length);long intersection=0,union=0,mismatch=0;
                        for(int p=0;p<expected.length;p++){boolean a=m.pixels[p]!=0,b=expected[p]!=0;if(a&&b)intersection++;if(a||b)union++;if(a!=b)mismatch++;}
                        double iou=union==0?1:(double)intersection/union;exact&=mismatch==0;
                        File png=Images.temp(MlProof.context(),"research-mask-");Images.maskPng(m.pixels,engine.width(handle),engine.height(handle),png);engine.retainFile(handle,png);retained.add(png);
                        byte[] bytes=Files.readAllBytes(png.toPath());assertEquals(8,bytes[24]);assertEquals("PNG color type must be grayscale",0,bytes[25]);
                        if(rank>0)assertTrue(actual.get(rank-1).score>=m.score);
                        results.put(new JSONObject().put("image",row.getString("image")).put("decoderIndex",m.decoderIndex).put("rank",rank).put("score",m.score).put("iou",iou).put("mismatchPixels",mismatch));
                    }
                    engine.release(handle);
                    for(File png:retained)assertFalse("Released handle must remove its candidate mask files",png.exists());
                    try{engine.tap(MlProof.context(),handle,.5,.5);fail("Released handle must expire");}catch(IOException e){assertEquals("handle_expired",e.getMessage());}
                }
                Bitmap image=MlProof.image(masks.getJSONObject(0).getString("image"));
                try {
                    String old=engine.prepare(MlProof.context(),image,null);
                    File oldMask=Images.temp(MlProof.context(),"replaced-mask-");engine.retainFile(old,oldMask);
                    String current=engine.prepare(MlProof.context(),image,null);
                    assertFalse("Replacing a handle must remove its candidate mask files",oldMask.exists());
                    try{engine.width(old);fail("Replacement must expire old handle");}catch(IOException e){assertEquals("handle_expired",e.getMessage());}
                    engine.tap(MlProof.context(),current,1,1);
                    File source=Images.temp(MlProof.context(),"deleted-source-");Images.png(image,source);String deleted=engine.prepare(MlProof.context(),image,source);assertTrue(source.delete());
                    try{engine.tap(MlProof.context(),deleted,.5,.5);fail("Deleted photo cannot use cached features");}catch(IOException e){assertEquals("handle_expired",e.getMessage());}
                } finally {image.recycle();}
            } finally {engine.release();}
        }
        MlProof.report("segmenter-research",new JSONObject().put("masks",results).put("allExact",exact));assertTrue("All six frozen binary masks must have IoU=1",exact);
    }
}
