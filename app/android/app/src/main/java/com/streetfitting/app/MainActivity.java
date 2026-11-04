package com.streetfitting.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.streetfitting.app.plugins.shopping.ShoppingSessionPlugin;
import com.streetfitting.app.plugins.capture.CapturePlugin;
import com.streetfitting.app.plugins.photoindex.PhotoIndexPlugin;
import com.streetfitting.app.plugins.segmenter.SegmenterPlugin;
import com.streetfitting.app.plugins.facemask.FaceMaskPlugin;
import com.streetfitting.app.plugins.media.MediaPlugin;
import com.streetfitting.app.plugins.voice.VoicePlugin;
import com.streetfitting.app.plugins.store.StorePlugin;
import com.streetfitting.app.auth.SfAuthPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ShoppingSessionPlugin.class);
        registerPlugin(CapturePlugin.class);
        registerPlugin(PhotoIndexPlugin.class);
        registerPlugin(SegmenterPlugin.class);
        registerPlugin(FaceMaskPlugin.class);
        registerPlugin(MediaPlugin.class);
        registerPlugin(VoicePlugin.class);
        registerPlugin(StorePlugin.class);
        registerPlugin(SfAuthPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
