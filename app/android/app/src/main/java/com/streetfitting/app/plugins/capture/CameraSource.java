package com.streetfitting.app.plugins.capture;

import android.app.Activity;
import android.view.View;
import androidx.camera.core.CameraSelector;
import androidx.camera.core.ImageCapture;
import androidx.camera.core.ImageCaptureException;
import androidx.camera.core.Preview;
import androidx.camera.lifecycle.ProcessCameraProvider;
import androidx.camera.view.PreviewView;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.LifecycleOwner;
import java.io.File;
import java.util.concurrent.CompletableFuture;

final class CameraSource implements CaptureSource {
    private final Activity activity;
    private final boolean front;
    private final PreviewView preview;
    private ProcessCameraProvider provider;
    private ImageCapture capture;
    private Preview stream;
    private boolean stopped;
    private int generation;
    CameraSource(Activity activity, boolean front) {
        this.activity = activity; this.front = front;
        preview = new PreviewView(activity); preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        preview.setScaleType(PreviewView.ScaleType.FILL_CENTER);
    }
    public View view() { return preview; }
    public CompletableFuture<Void> start() {
        stop();
        int opening = ++generation;
        CompletableFuture<Void> result = new CompletableFuture<>(); stopped = false;
        com.google.common.util.concurrent.ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(activity);
        future.addListener(() -> {
            String stage = "provider";
            try {
                if (stopped || generation != opening) { result.completeExceptionally(new IllegalStateException("preview_not_open")); return; }
                provider = future.get();
                stage = "use_cases";
                stream = new Preview.Builder().build(); stream.setSurfaceProvider(preview.getSurfaceProvider());
                capture = new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).setTargetRotation(activity.getWindowManager().getDefaultDisplay().getRotation()).build();
                stage = "bind";
                provider.bindToLifecycle((LifecycleOwner)activity, front ? CameraSelector.DEFAULT_FRONT_CAMERA : CameraSelector.DEFAULT_BACK_CAMERA, stream, capture);
                result.complete(null);
            } catch (Exception error) {
                reportFailure(stage, error);
                result.completeExceptionally(new IllegalStateException("camera_unavailable"));
            }
        }, ContextCompat.getMainExecutor(activity));
        return result;
    }
    public CompletableFuture<File> capture(File destination) {
        CompletableFuture<File> result = new CompletableFuture<>();
        if (capture == null || stopped) { result.completeExceptionally(new IllegalStateException("preview_not_open")); return result; }
        capture.setTargetRotation(activity.getWindowManager().getDefaultDisplay().getRotation());
        capture.takePicture(new ImageCapture.OutputFileOptions.Builder(destination).build(), ContextCompat.getMainExecutor(activity), new ImageCapture.OnImageSavedCallback() {
            @Override public void onImageSaved(ImageCapture.OutputFileResults saved) { result.complete(destination); }
            @Override public void onError(ImageCaptureException error) {
                reportFailure("shutter", error);
                destination.delete();
                result.completeExceptionally(new IllegalStateException(error.getImageCaptureError() == ImageCapture.ERROR_FILE_IO ? "io_error" : "camera_unavailable"));
            }
        });
        return result;
    }
    public void committed() { }
    private void reportFailure(String stage, Throwable error) {
        if ((activity.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) == 0) return;
        Throwable root = error;
        while (root.getCause() != null) root = root.getCause();
        StackTraceElement[] frames = root.getStackTrace();
        StringBuilder metadata = new StringBuilder("stage=").append(stage).append(" type=").append(error.getClass().getName())
            .append(" cause=").append(root.getClass().getName());
        for (int i = 0; i < Math.min(3, frames.length); i++) metadata.append(" at=").append(frames[i]);
        if (root instanceof android.hardware.camera2.CameraAccessException)
            metadata.append(" cameraReason=").append(((android.hardware.camera2.CameraAccessException)root).getReason());
        android.util.Log.w("StreetFittingCapture", metadata.toString());
    }
    public void stop() { generation++; stopped = true; if (provider != null && capture != null && stream != null) provider.unbind(stream, capture); capture = null; stream = null; }
}
