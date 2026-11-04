package com.streetfitting.app.plugins.voice;

import android.content.Intent;
import android.os.SystemClock;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import com.getcapacitor.JSObject;
import com.streetfitting.app.plugins.shopping.NativeHarness;
import java.io.File;
import java.io.RandomAccessFile;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class VoiceContractTest {
    private NativeHarness fixture(String scenario) {
        return new NativeHarness(new Intent().putExtra("sf_voice_source", "fixture").putExtra("sf_voice_fixture_dir", "/sdcard/Android/data/com.streetfitting.app/files/voice-fixtures/" + scenario));
    }
    @Test public void speechThenSilenceStopsOnce() throws Exception {
        try (NativeHarness harness = fixture("tone-silence")) {
            NativeHarness.TestCall completed = harness.listen("Voice", "completed"); NativeHarness.TestCall states = harness.listen("Voice", "state");
            long start = SystemClock.elapsedRealtime(); harness.invoke("Voice", "start", new JSObject()).await();
            JSObject recording = completed.await(); long duration = SystemClock.elapsedRealtime() - start;
            assertTrue(duration >= 1200 && duration < 5000); assertEquals(1, completed.values.size());
            assertEquals("silence", states.values.get(states.values.size() - 1).optString("reason"));
            assertEquals(recording.toString(), harness.invoke("Voice", "stop", new JSObject()).await().toString());
            assertEquals(recording.toString(), harness.invoke("Voice", "stop", new JSObject()).await().toString()); assertEquals(1, completed.values.size());
            File file = new File(android.net.Uri.parse(recording.optString("file")).getPath());
            try (RandomAccessFile wav = new RandomAccessFile(file, "r")) { assertEquals(44 + recording.optInt("durationMs") * 32, wav.length()); }
            harness.invoke("Voice", "cancel", new JSObject()).await(); assertFalse(file.exists());
        }
    }
    @Test public void leadingSilenceFailsAtFiveSeconds() throws Exception {
        try (NativeHarness harness = fixture("silence")) {
            NativeHarness.TestCall errors = harness.listen("Voice", "error"); NativeHarness.TestCall completed = harness.listen("Voice", "completed");
            long start = SystemClock.elapsedRealtime(); harness.invoke("Voice", "start", new JSObject()).await();
            assertEquals("no_speech", errors.await().optString("code")); long duration = SystemClock.elapsedRealtime() - start;
            assertTrue(duration >= 4900 && duration < 8000); assertEquals(1, errors.values.size()); assertEquals(0, completed.values.size());
            assertEquals("no_speech", harness.invoke("Voice", "stop", new JSObject()).failure());
        }
    }
    @Test public void limitStopsAtFifteenSeconds() throws Exception {
        try (NativeHarness harness = fixture("limit-15s")) {
            NativeHarness.TestCall completed = harness.listen("Voice", "completed"); NativeHarness.TestCall states = harness.listen("Voice", "state");
            long start = SystemClock.elapsedRealtime(); harness.invoke("Voice", "start", new JSObject()).await(); JSObject value = completed.await();
            assertEquals(15000, value.optInt("durationMs")); assertTrue(SystemClock.elapsedRealtime() - start >= 14900);
            assertEquals("limit", states.values.get(states.values.size() - 1).optString("reason")); assertEquals(1, completed.values.size());
            assertEquals(480044, new File(android.net.Uri.parse(value.optString("file")).getPath()).length());
            harness.invoke("Voice", "cancel", new JSObject()).await();
        }
    }
    @Test public void cancelDeletesWav() throws Exception {
        try (NativeHarness harness = fixture("limit-15s")) {
            NativeHarness.TestCall completed = harness.listen("Voice", "completed");
            harness.invoke("Voice", "start", new JSObject()).await(); SystemClock.sleep(250);
            harness.invoke("Voice", "cancel", new JSObject()).await(); assertEquals(0, completed.values.size());
            File[] files = new File(harness.context.getCacheDir(), "voice").listFiles(); assertNotNull(files); assertEquals(0, files.length);
            assertEquals("not_recording", harness.invoke("Voice", "stop", new JSObject()).failure());
        }
    }
    @Test public void invalidFixtureNeverFallsBackToMic() throws Exception {
        try (NativeHarness harness = fixture("corrupt")) {
            NativeHarness.TestCall completed = harness.listen("Voice", "completed");
            assertEquals("invalid_fixture", harness.invoke("Voice", "start", new JSObject()).failure()); assertEquals(0, completed.values.size());
        }
        try (NativeHarness harness = fixture("empty")) {
            assertEquals("fixture_missing", harness.invoke("Voice", "start", new JSObject()).failure());
        }
    }
    @Test public void sourceOverrideCannotEscapeAppFiles() throws Exception {
        try (NativeHarness harness = new NativeHarness(new Intent().putExtra("sf_voice_source", "fixture").putExtra("sf_voice_fixture_dir", "/sdcard"))) {
            assertEquals("invalid_fixture", harness.invoke("Voice", "start", new JSObject()).failure());
        }
    }
}
