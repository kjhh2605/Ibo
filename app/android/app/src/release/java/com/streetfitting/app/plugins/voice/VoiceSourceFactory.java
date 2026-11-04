package com.streetfitting.app.plugins.voice;

import android.app.Activity;
import java.io.IOException;

final class VoiceSourceFactory {
    static boolean fixture(Activity activity) { return false; }
    static PcmSource open(Activity activity) throws IOException { return new MicrophoneSource(); }
}
