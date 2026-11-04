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
    CameraSource(Activity activity, boolean front) {
        this.activity = activity; this.front = front;
        preview = new PreviewView(activity); preview.setImplementationMode(PreviewView.ImplementationMode.COMPATIBLE);
        preview.setScaleType(PreviewView.ScaleType.FILL_CENTER);
    }
    public View view() { return preview; }
    public CompletableFuture<Void> start() {
        CompletableFuture<Void> result = new CompletableFuture<>(); stopped = false;
        com.google.common.util.concurrent.ListenableFuture<ProcessCameraProvider> future = ProcessCameraProvider.getInstance(activity);
        future.addListener(() -> {
            try {
                if (stopped) { result.completeExceptionally(new IllegalStateException("preview_closed")); return; }
                provider = future.get();
                stream = new Preview.Builder().build(); stream.setSurfaceProvider(preview.getSurfaceProvider());
                capture = new ImageCapture.Builder().setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY).setTargetRotation(activity.getWindowManager().getDefaultDisplay().getRotation()).build();
                provider.bindToLifecycle((LifecycleOwner)activity, front ? CameraSelector.DEFAULT_FRONT_CAMERA : CameraSelector.DEFAULT_BACK_CAMERA, stream, capture);
                result.complete(null);
            } catch (Exception error) { result.completeExceptionally(new IllegalStateException("camera_unavailable")); }
        }, ContextCompat.getMainExecutor(activity));
        return result;
    }
    public CompletableFuture<File> capture(File destination) {
        CompletableFuture<File> result = new CompletableFuture<>();
        if (capture == null || stopped) { result.completeExceptionally(new IllegalStateException("preview_not_ready")); return result; }
        capture.setTargetRotation(activity.getWindowManager().getDefaultDisplay().getRotation());
        capture.takePicture(new ImageCapture.OutputFileOptions.Builder(destination).build(), ContextCompat.getMainExecutor(activity), new ImageCapture.OnImageSavedCallback() {
            @Override public void onImageSaved(ImageCapture.OutputFileResults saved) { result.complete(destination); }
            @Override public void onError(ImageCaptureException error) { destination.delete(); result.completeExceptionally(new IllegalStateException("capture_failed")); }
        });
        return result;
    }
    public void committed() { }
    public void stop() { stopped = true; if (provider != null && capture != null && stream != null) provider.unbind(stream, capture); capture = null; stream = null; }
}
