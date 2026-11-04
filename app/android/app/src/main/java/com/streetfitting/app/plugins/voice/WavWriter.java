package com.streetfitting.app.plugins.voice;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;

final class WavWriter implements AutoCloseable {
    private final RandomAccessFile out;
    private final byte[] bytes = new byte[EnergyVad.FRAME_SAMPLES * 2];
    private int samples;

    WavWriter(File file) throws IOException {
        out = new RandomAccessFile(file, "rw");
        out.setLength(0);
        out.write(new byte[44]);
    }
    void append(short[] frame, int count) throws IOException {
        for (int i = 0; i < count; i++) {
            bytes[2 * i] = (byte) frame[i];
            bytes[2 * i + 1] = (byte) (frame[i] >>> 8);
        }
        out.write(bytes, 0, count * 2);
        samples += count;
    }
    private void u16(int n) throws IOException { out.write(n); out.write(n >>> 8); }
    private void u32(int n) throws IOException { u16(n); u16(n >>> 16); }
    @Override public void close() throws IOException {
        try {
            out.seek(0);
            out.writeBytes("RIFF"); u32(36 + samples * 2); out.writeBytes("WAVEfmt ");
            u32(16); u16(1); u16(1); u32(16000); u32(32000); u16(2); u16(16);
            out.writeBytes("data"); u32(samples * 2);
            out.getFD().sync();
        } finally { out.close(); }
    }
}
