package com.streetfitting.app.plugins.voice;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;
import static org.junit.Assert.*;
import java.io.File;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.file.Files;
import java.nio.charset.StandardCharsets;

public class WavWriterTest {
    @Rule public TemporaryFolder directory = new TemporaryFolder();
    @Test public void headerAndSignedSamplesAreCanonicalLittleEndian() throws Exception {
        File file = directory.newFile("voice.wav");
        try (WavWriter writer = new WavWriter(file)) { writer.append(new short[]{Short.MIN_VALUE, -1, 0, 1, Short.MAX_VALUE}, 5); }
        byte[] bytes = Files.readAllBytes(file.toPath()); ByteBuffer data = ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
        assertEquals(54, bytes.length); assertEquals("RIFF", new String(bytes, 0, 4, StandardCharsets.US_ASCII));
        assertEquals(46, data.getInt(4)); assertEquals("WAVE", new String(bytes, 8, 4, StandardCharsets.US_ASCII));
        assertEquals(16, data.getInt(16)); assertEquals(1, data.getShort(20)); assertEquals(1, data.getShort(22));
        assertEquals(16000, data.getInt(24)); assertEquals(32000, data.getInt(28)); assertEquals(2, data.getShort(32)); assertEquals(16, data.getShort(34)); assertEquals(10, data.getInt(40));
        assertEquals(Short.MIN_VALUE, data.getShort(44)); assertEquals(-1, data.getShort(46)); assertEquals(0, data.getShort(48)); assertEquals(1, data.getShort(50)); assertEquals(Short.MAX_VALUE, data.getShort(52));
    }
}
