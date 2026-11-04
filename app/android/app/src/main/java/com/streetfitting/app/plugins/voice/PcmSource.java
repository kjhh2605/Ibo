package com.streetfitting.app.plugins.voice;

import java.io.IOException;

public interface PcmSource extends AutoCloseable {
    int read(short[] frame) throws IOException;
    @Override void close();
}
