package com.streetfitting.app.plugins.capture;

import android.app.Activity;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.ImageView;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;

final class CaptureSourceFactory {
    private static String key;
    private static int index;
    static boolean fixture(Activity activity) { return "fixture".equals(activity.getIntent().getStringExtra("sf_capture_source")); }
    static synchronized CaptureSource create(Activity activity, boolean front) {
        if (!fixture(activity)) { key = null; index = 0; return new CameraSource(activity, front); }
        try {
            File root = activity.getExternalFilesDir(null).getCanonicalFile();
            String path = activity.getIntent().getStringExtra("sf_capture_fixture_dir");
            File directory = (path == null ? new File(root, "capture-fixtures") : new File(path)).getCanonicalFile();
            if (!directory.getPath().startsWith(root.getPath() + File.separator)) throw new IOException();
            if (!directory.getPath().equals(key)) { key = directory.getPath(); index = 0; }
            File[] files = directory.listFiles(file -> {
                String name = file.getName().toLowerCase(Locale.ROOT);
                return file.isFile() && (name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png"));
            });
            if (files == null || files.length == 0) throw new IOException();
            Arrays.sort(files, Comparator.comparing(File::getName));
            for (File file : files) if (!file.getCanonicalPath().startsWith(directory.getPath() + File.separator)) throw new IOException();
            return new FixtureSource(activity, files);
        } catch (IOException error) { throw new IllegalStateException("fixture_unavailable"); }
    }
    private static final class FixtureSource implements CaptureSource {
        private final ImageView view;
        private final File[] files;
        private Bitmap bitmap;
        FixtureSource(Activity activity, File[] files) { this.files = files; view = new ImageView(activity); view.setScaleType(ImageView.ScaleType.CENTER_CROP); }
        public View view() { return view; }
        public CompletableFuture<Void> start() {
            CompletableFuture<Void> result = new CompletableFuture<>();
            try { display(); result.complete(null); } catch (RuntimeException error) { result.completeExceptionally(error); }
            return result;
        }
        private File selected() { synchronized (CaptureSourceFactory.class) { return files[index % files.length]; } }
        private void display() {
            Bitmap replacement = BitmapFactory.decodeFile(selected().getPath());
            if (replacement == null) throw new IllegalStateException("invalid_fixture");
            view.setImageBitmap(replacement); if (bitmap != null) bitmap.recycle(); bitmap = replacement;
        }
        public CompletableFuture<File> capture(File destination) {
            CompletableFuture<File> result = new CompletableFuture<>();
            try (FileInputStream input = new FileInputStream(selected()); FileOutputStream output = new FileOutputStream(destination)) {
                byte[] buffer = new byte[32768]; int length;
                while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
                output.getFD().sync(); result.complete(destination);
            } catch (IOException error) { destination.delete(); result.completeExceptionally(new IllegalStateException("invalid_fixture")); }
            return result;
        }
        public void committed() { synchronized (CaptureSourceFactory.class) { index++; } display(); }
        public void stop() { view.setImageDrawable(null); if (bitmap != null) bitmap.recycle(); bitmap = null; }
    }
}
