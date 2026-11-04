package com.streetfitting.app.plugins.voice;

/** Sample-count based VAD: hardware and debug WAV inputs share this exact core. */
public final class EnergyVad {
    public static final int SAMPLE_RATE = 16000;
    public static final int FRAME_SAMPLES = 320;
    public static final int MAX_SAMPLES = 240000;
    private final double threshold;
    private int samples;
    private int consecutiveSpeech;
    private int voicedSamples;
    private int silenceSamples;
    private boolean speechStarted;
    private double level = -160;

    public EnergyVad() { this(-40); }
    public EnergyVad(double threshold) { this.threshold = threshold; }

    public String accept(short[] frame, int count) {
        if (count <= 0 || count > FRAME_SAMPLES || samples + count > MAX_SAMPLES) {
            throw new IllegalArgumentException("Invalid audio frame");
        }
        double squares = 0;
        for (int i = 0; i < count; i++) squares += (double) frame[i] * frame[i];
        level = 20 * Math.log10(Math.max(Math.sqrt(squares / count) / 32768, 1e-8));
        samples += count;
        if (level > threshold) {
            consecutiveSpeech += count;
            voicedSamples += count;
            silenceSamples = 0;
            if (consecutiveSpeech >= 960) speechStarted = true;
        } else {
            consecutiveSpeech = 0;
            if (speechStarted) silenceSamples += count;
        }
        if (!speechStarted && samples >= 80000) return "no_speech";
        if (samples >= MAX_SAMPLES) return "limit";
        if (speechStarted && silenceSamples >= 16000) return "silence";
        return null;
    }

    public boolean hasSpeech() { return speechStarted && voicedSamples >= 3200; }
    public int samples() { return samples; }
    public double level() { return level; }
}
