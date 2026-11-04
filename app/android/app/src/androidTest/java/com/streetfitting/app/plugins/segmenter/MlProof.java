package com.streetfitting.app.plugins.segmenter;

import android.content.Context;
import android.graphics.*;
import androidx.test.platform.app.InstrumentationRegistry;
import org.json.*;
import java.io.*;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public final class MlProof {
    private MlProof() {}
    public static Context context(){return InstrumentationRegistry.getInstrumentation().getTargetContext();}
    public static File root(){return new File(context().getFilesDir(),"ml-proof");}
    public static File file(String name){return new File(root(),name);}
    public static JSONObject json(String name)throws Exception{return new JSONObject(new String(Files.readAllBytes(file(name).toPath()),StandardCharsets.UTF_8));}
    public static Bitmap image(String name)throws Exception{return com.streetfitting.app.plugins.segmenter.model.Images.decode(context(),file(name).toURI().toString());}
    public static float[] floats(String name)throws Exception{
        byte[] bytes=Files.readAllBytes(file(name).toPath());FloatBuffer values=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN).asFloatBuffer();float[] result=new float[values.remaining()];values.get(result);return result;
    }
    public static synchronized void report(String name,JSONObject value)throws Exception{
        File dir=file("results");if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("results directory");
        value.put("package",context().getPackageName());value.put("ortVersion",com.streetfitting.app.plugins.segmenter.model.Models.ENV.getVersion());
        Files.write(new File(dir,name+".json").toPath(),value.toString(2).getBytes(StandardCharsets.UTF_8));
    }
}
