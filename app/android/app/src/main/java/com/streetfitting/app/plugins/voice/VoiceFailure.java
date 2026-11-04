package com.streetfitting.app.plugins.voice;

import java.io.IOException;

public final class VoiceFailure extends IOException {
    public final String code;
    public VoiceFailure(String code) { super(code); this.code = code; }
}
