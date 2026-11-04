package com.streetfitting.app.plugins.media;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.UUID;

public final class ImageFiles {
    private ImageFiles() { }
    public static JSObject normalize(Context context, File input, String directory, boolean mirror) throws IOException {
        Bitmap decoded = BitmapFactory.decodeFile(input.getPath());
        if (decoded == null) throw new IOException("invalid_image");
        Bitmap normalized = decoded;
        File output = null;
        try {
            ExifInterface exif = new ExifInterface(input);
            Matrix matrix = new Matrix();
            if (exif.isFlipped()) matrix.postScale(-1, 1);
            matrix.postRotate(exif.getRotationDegrees());
            if (mirror) matrix.postScale(-1, 1);
            if (!matrix.isIdentity()) normalized = Bitmap.createBitmap(decoded, 0, 0, decoded.getWidth(), decoded.getHeight(), matrix, true);
            File root = new File(context.getCacheDir(), directory);
            if (!root.isDirectory() && !root.mkdirs()) throw new IOException("io_error");
            String id = UUID.randomUUID().toString(); output = new File(root, id + ".jpg");
            try (FileOutputStream stream = new FileOutputStream(output)) {
                if (!normalized.compress(Bitmap.CompressFormat.JPEG, 95, stream)) throw new IOException("io_error");
                stream.getFD().sync();
            }
            return new JSObject().put("id", id).put("file", output.toURI().toString()).put("w", normalized.getWidth()).put("h", normalized.getHeight());
        } catch (IOException | RuntimeException error) { if (output != null) output.delete(); throw error; }
        finally { if (normalized != decoded) normalized.recycle(); decoded.recycle(); }
    }
    public static File local(String ref) throws IOException {
        android.net.Uri uri = android.net.Uri.parse(ref);
        if (!"file".equals(uri.getScheme()) || uri.getPath() == null) throw new IOException("invalid_file");
        return new File(uri.getPath()).getCanonicalFile();
    }
}
