package com.streetfitting.app.plugins.voice;

import org.junit.Test;
import static org.junit.Assert.*;
import java.util.Arrays;

public class EnergyVadTest {
    private short[] tone() { short[] frame = new short[320]; Arrays.fill(frame, (short)2000); return frame; }
    @Test public void leadingSilenceEndsAtExactlyFiveSeconds() {
        EnergyVad vad = new EnergyVad(); short[] silence = new short[320];
        for (int i = 0; i < 249; i++) assertNull(vad.accept(silence, 320));
        assertEquals("no_speech", vad.accept(silence, 320)); assertEquals(80000, vad.samples()); assertFalse(vad.hasSpeech());
    }
    @Test public void speechNeedsSixtyMillisecondsAndTwoHundredVoicedMilliseconds() {
        EnergyVad vad = new EnergyVad();
        for (int i = 0; i < 9; i++) { assertNull(vad.accept(tone(), 320)); assertFalse(vad.hasSpeech()); }
        assertNull(vad.accept(tone(), 320)); assertTrue(vad.hasSpeech());
        for (int i = 0; i < 49; i++) assertNull(vad.accept(new short[320], 320));
        assertEquals("silence", vad.accept(new short[320], 320)); assertEquals(19200, vad.samples());
    }
    @Test public void continuousSpeechStopsAtFifteenSeconds() {
        EnergyVad vad = new EnergyVad(); short[] voice = tone();
        for (int i = 0; i < 749; i++) assertNull(vad.accept(voice, 320));
        assertEquals("limit", vad.accept(voice, 320)); assertEquals(240000, vad.samples()); assertTrue(vad.hasSpeech());
    }
    @Test public void IsolatedEnergySpikesDoNotStartSpeech() {
        EnergyVad vad = new EnergyVad(); short[] voice = tone(); short[] silence = new short[320];
        for (int i = 0; i < 124; i++) { assertNull(vad.accept(voice, 320)); assertNull(vad.accept(silence, 320)); }
        assertNull(vad.accept(voice, 320)); assertEquals("no_speech", vad.accept(silence, 320)); assertFalse(vad.hasSpeech());
    }
}
