package com.streetfitting.app.plugins.voice;

import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import java.io.IOException;

final class MicrophoneSource implements PcmSource {
    private final AudioRecord recorder;
    private volatile boolean closed;

    MicrophoneSource() throws VoiceFailure {
        int size = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT);
        if (size <= 0) throw new VoiceFailure("audio_unavailable");
        recorder = new AudioRecord(MediaRecorder.AudioSource.MIC, 16000, AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT, Math.max(size, 2560));
        if (recorder.getState() != AudioRecord.STATE_INITIALIZED || recorder.getSampleRate() != 16000) {
            recorder.release();
            throw new VoiceFailure("audio_unavailable");
        }
        try { recorder.startRecording(); }
        catch (RuntimeException e) { recorder.release(); throw new VoiceFailure("audio_unavailable"); }
        if (recorder.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            recorder.release(); throw new VoiceFailure("audio_unavailable");
        }
    }

    @Override public int read(short[] frame) throws IOException {
        if (closed) return -1;
        int read = recorder.read(frame, 0, frame.length, AudioRecord.READ_BLOCKING);
        if (read <= 0) throw new VoiceFailure("audio_unavailable");
        return read;
    }

    @Override public synchronized void close() {
        if (closed) return;
        closed = true;
        try { recorder.stop(); } catch (IllegalStateException ignored) { }
        recorder.release();
    }
}
