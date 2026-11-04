package com.streetfitting.app.plugins.voice;

import com.getcapacitor.JSObject;
import java.io.File;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

/** One recording owns one source and one terminal future; completion is never duplicated. */
public final class VoiceRecorder {
    public interface Events { void emit(String name, JSObject value); }
    private final File directory;
    private final Events events;
    private Run current;
    private static final class Run {
        final PcmSource source;
        final File file;
        final CompletableFuture<JSObject> done = new CompletableFuture<>();
        boolean cancelled;
        String requestedStop;
        Run(PcmSource source, File file) { this.source = source; this.file = file; }
    }
    public VoiceRecorder(File directory, Events events) { this.directory = directory; this.events = events; }
    public synchronized boolean active() { return current != null && !current.done.isDone(); }
    public synchronized void start(PcmSource source) throws IOException {
        if (active()) { source.close(); throw new VoiceFailure("busy"); }
        if (!directory.isDirectory() && !directory.mkdirs()) {
            source.close(); throw new VoiceFailure("io_error");
        }
        Run run = new Run(source, new File(directory, UUID.randomUUID() + ".wav"));
        current = run;
        events.emit("state", new JSObject().put("state", "recording"));
        new Thread(() -> record(run), "sf-voice").start();
    }
    public synchronized CompletableFuture<JSObject> stop() {
        if (current == null) {
            CompletableFuture<JSObject> failure = new CompletableFuture<>();
            failure.completeExceptionally(new VoiceFailure("not_recording")); return failure;
        }
        if (!current.done.isDone()) current.requestedStop = "manual";
        return current.done;
    }
    public synchronized CompletableFuture<Void> cancel() {
        if (current == null) return CompletableFuture.completedFuture(null);
        Run run = current;
        if (run.done.isDone()) { run.file.delete(); current = null; return CompletableFuture.completedFuture(null); }
        run.cancelled = true;
        // A frame read is at most 20ms; the recorder thread alone owns source/file teardown.
        return run.done.handle((result, error) -> null);
    }
    private void record(Run run) {
        EnergyVad vad = new EnergyVad();
        String reason = null;
        String error = null;
        short[] frame = new short[EnergyVad.FRAME_SAMPLES];
        try (WavWriter writer = new WavWriter(run.file)) {
            while (reason == null) {
                synchronized (this) {
                    if (run.cancelled) { reason = "cancelled"; break; }
                    if (run.requestedStop != null) { reason = run.requestedStop; break; }
                }
                int count = run.source.read(frame);
                if (count < 0) { reason = "manual"; break; }
                if (count == 0) throw new VoiceFailure("audio_unavailable");
                count = Math.min(count, EnergyVad.MAX_SAMPLES - vad.samples());
                writer.append(frame, count);
                reason = vad.accept(frame, count);
                synchronized (this) {
                    if (!run.cancelled) events.emit("level", new JSObject().put("rmsDbfs", vad.level()));
                }
            }
        } catch (IOException | RuntimeException e) {
            error = e instanceof VoiceFailure ? ((VoiceFailure) e).code : "io_error";
        } finally {
            try { run.source.close(); } catch (RuntimeException failure) { if (error == null) error = "audio_unavailable"; }
        }
        synchronized (this) {
            if (run.cancelled) {
                run.file.delete();
                events.emit("state", new JSObject().put("state", "stopped").put("reason", "cancelled"));
                run.done.completeExceptionally(new VoiceFailure("cancelled"));
                if (current == run) current = null;
                return;
            }
            if (error == null && !vad.hasSpeech()) error = "no_speech";
            JSObject state = new JSObject().put("state", "stopped");
            if (reason != null && !reason.equals("no_speech")) state.put("reason", reason);
            events.emit("state", state);
            if (error != null) {
                run.file.delete();
                events.emit("error", new JSObject().put("code", error).put("retryable", true));
                run.done.completeExceptionally(new VoiceFailure(error));
            } else {
                JSObject result = new JSObject().put("file", run.file.toURI().toString())
                    .put("durationMs", vad.samples() * 1000 / 16000).put("sampleRate", 16000)
                    .put("channels", 1).put("bitsPerSample", 16);
                events.emit("completed", result);
                run.done.complete(result);
            }
        }
    }
}
