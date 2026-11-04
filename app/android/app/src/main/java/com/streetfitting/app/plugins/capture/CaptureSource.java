package com.streetfitting.app.plugins.capture;

import android.view.View;
import java.io.File;
import java.util.concurrent.CompletableFuture;

interface CaptureSource {
    View view();
    CompletableFuture<Void> start();
    CompletableFuture<File> capture(File destination);
    void committed();
    void stop();
}
