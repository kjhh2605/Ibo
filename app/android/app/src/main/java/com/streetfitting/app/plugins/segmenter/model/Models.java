package com.streetfitting.app.plugins.segmenter.model;

import android.content.Context;
import ai.onnxruntime.*;
import java.io.*;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;

/** Process-shared CPU sessions. Model bytes are streamed, never materialized on the Java heap. */
public final class Models {
    private static final String[] FILES = {"edgetam_encoder.onnx", "edgetam_decoder.onnx", "pe_image.onnx"};
    private static final String[] HASHES = {
        "b13dd3cc3a60996e9f2a1ef55cdc3b9e70366706bd108d65ed6ea615543c918e",
        "ceaa17668b6bd70fb7d1d79f8b78274d71101696e16ba31eef7ee5d8fef16978",
        "10b2683490922a82a61ee108673fc94ea455c6ad3996b1f2dc86f93a935d114c"};
    private static final OrtSession[] SESSIONS = new OrtSession[3];
    public static final OrtEnvironment ENV = OrtEnvironment.getEnvironment();
    private Models() {}

    public static synchronized OrtSession session(Context context, int model) throws Exception {
        if (SESSIONS[model] != null) return SESSIONS[model];
        File dir = new File(context.getFilesDir(), "models/" + HASHES[model]);
        if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("model_missing");
        File target = new File(dir, FILES[model]);
        if (!target.isFile() || !HASHES[model].equals(hash(target))) {
            File temp = File.createTempFile("model-", ".part", dir);
            try {
                try (InputStream in = context.getAssets().open("models/" + FILES[model]); OutputStream out = new FileOutputStream(temp)) {
                    byte[] buffer = new byte[65536];
                    for (int n; (n = in.read(buffer)) != -1;) out.write(buffer, 0, n);
                }
                if (!HASHES[model].equals(hash(temp))) throw new IOException("model_invalid");
                Files.move(temp.toPath(), target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            } finally { temp.delete(); }
        }
        try (OrtSession.SessionOptions options = new OrtSession.SessionOptions()) {
            options.setIntraOpNumThreads(2);
            options.setInterOpNumThreads(1);
            OrtSession session = ENV.createSession(target.getAbsolutePath(), options);
            try { validate(session, model); } catch (Exception e) { session.close(); throw e; }
            return SESSIONS[model] = session;
        }
    }

    public static String hash(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[65536];
            for (int n; (n = in.read(buffer)) != -1;) digest.update(buffer, 0, n);
        }
        StringBuilder hex = new StringBuilder(64);
        for (byte b : digest.digest()) hex.append(String.format(Locale.ROOT, "%02x", b & 255));
        return hex.toString();
    }

    private static void shape(Map<String, NodeInfo> nodes, String name, OnnxJavaType type, long... expected) throws IOException {
        NodeInfo node = nodes.get(name);
        if (node == null || !(node.getInfo() instanceof TensorInfo)) throw new IOException("model_invalid");
        TensorInfo info = (TensorInfo) node.getInfo();
        if (info.type != type || !Arrays.equals(info.getShape(), expected)) throw new IOException("model_invalid");
    }
    private static void validate(OrtSession session, int model) throws Exception {
        Map<String, NodeInfo> in = session.getInputInfo(), out = session.getOutputInfo();
        if (model == 0) {
            shape(in, "image", OnnxJavaType.FLOAT, 1,3,1024,1024);
            shape(out, "embedding", OnnxJavaType.FLOAT, 1,256,64,64);
            shape(out, "high0", OnnxJavaType.FLOAT, 1,32,256,256);
            shape(out, "high1", OnnxJavaType.FLOAT, 1,64,128,128);
        } else if (model == 1) {
            shape(in, "embedding", OnnxJavaType.FLOAT, 1,256,64,64);
            shape(in, "high0", OnnxJavaType.FLOAT, 1,32,256,256);
            shape(in, "high1", OnnxJavaType.FLOAT, 1,64,128,128);
            shape(in, "coords", OnnxJavaType.FLOAT, 1,1,2);
            shape(in, "labels", OnnxJavaType.INT64, 1,1);
            shape(out, "masks", OnnxJavaType.FLOAT, 1,3,256,256);
            shape(out, "scores", OnnxJavaType.FLOAT, 1,3);
        } else {
            shape(in, "image", OnnxJavaType.FLOAT, 1,3,384,384);
            shape(out, "embedding", OnnxJavaType.FLOAT, 1,512);
        }
    }
}
