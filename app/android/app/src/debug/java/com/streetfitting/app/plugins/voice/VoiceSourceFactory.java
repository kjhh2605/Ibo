package com.streetfitting.app.plugins.voice;

import android.app.Activity;
import android.content.Intent;
import android.os.SystemClock;
import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.util.Arrays;
import java.util.Comparator;

final class VoiceSourceFactory {
    private static String key;
    private static int index;
    static boolean fixture(Activity activity) {
        return "fixture".equals(activity.getIntent().getStringExtra("sf_voice_source"));
    }
    static synchronized PcmSource open(Activity activity) throws IOException {
        if (!fixture(activity)) { key = null; index = 0; return new MicrophoneSource(); }
        Intent intent = activity.getIntent();
        File root = activity.getExternalFilesDir(null).getCanonicalFile();
        String path = intent.getStringExtra("sf_voice_fixture_dir");
        File directory = (path == null ? new File(root, "voice-fixtures") : new File(path)).getCanonicalFile();
        if (!directory.getPath().startsWith(root.getPath() + File.separator)) throw new VoiceFailure("invalid_fixture");
        String selected = directory.getPath();
        if (!selected.equals(key)) { key = selected; index = 0; }
        File[] files = directory.listFiles(file -> file.isFile() && file.getName().toLowerCase(java.util.Locale.ROOT).endsWith(".wav"));
        if (files == null || files.length == 0) throw new VoiceFailure("fixture_missing");
        Arrays.sort(files, Comparator.comparing(File::getName));
        File file = files[index % files.length].getCanonicalFile();
        if (!file.getPath().startsWith(directory.getPath() + File.separator)) throw new VoiceFailure("invalid_fixture");
        PcmSource source = new FixtureSource(file);
        index++;
        return source;
    }
    private static final class FixtureSource implements PcmSource {
        private final RandomAccessFile file;
        private final byte[] bytes = new byte[640];
        private long remaining;
        private long next;
        FixtureSource(File input) throws IOException {
            file = new RandomAccessFile(input, "r");
            try {
                byte[] header = new byte[44]; file.readFully(header);
                if (!tag(header, 0, "RIFF") || !tag(header, 8, "WAVE") || !tag(header, 12, "fmt ") ||
                    number(header, 16, 4) != 16 || number(header, 20, 2) != 1 || number(header, 22, 2) != 1 ||
                    number(header, 24, 4) != 16000 || number(header, 28, 4) != 32000 || number(header, 32, 2) != 2 ||
                    number(header, 34, 2) != 16 || !tag(header, 36, "data")) throw new VoiceFailure("invalid_fixture");
                remaining = number(header, 40, 4);
                if (remaining <= 0 || remaining % 2 != 0 || remaining != file.length() - 44 || number(header, 4, 4) != file.length() - 8) throw new VoiceFailure("invalid_fixture");
                next = SystemClock.elapsedRealtime();
            } catch (IOException error) { file.close(); throw new VoiceFailure("invalid_fixture"); }
        }
        public int read(short[] samples) throws IOException {
            if (remaining == 0) return -1;
            int count = (int)Math.min(bytes.length, remaining);
            file.readFully(bytes, 0, count);
            remaining -= count;
            next += count * 1000L / 32000;
            long delay = next - SystemClock.elapsedRealtime();
            if (delay > 0) SystemClock.sleep(delay);
            for (int i = 0; i < count / 2; i++) samples[i] = (short)((bytes[i * 2] & 255) | (bytes[i * 2 + 1] << 8));
            return count / 2;
        }
        public void close() { try { file.close(); } catch (IOException ignored) { } }
        private static boolean tag(byte[] data, int at, String value) {
            for (int i = 0; i < value.length(); i++) if (data[at + i] != value.charAt(i)) return false;
            return true;
        }
        private static long number(byte[] data, int at, int size) {
            long value = 0;
            for (int i = 0; i < size; i++) value |= (long)(data[at + i] & 255) << (i * 8);
            return value;
        }
    }
}
