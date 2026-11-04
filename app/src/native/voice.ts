import {WebPlugin} from '@capacitor/core';
import type {Voice as VoiceContract, VoiceRecording} from './contracts';
import {registerDevicePlugin} from './registerDevicePlugin';
import {getMockContext} from './web/context';
import type {MockContext} from './web/context';
import {getWebRepository} from '../data/web/repository';
import {deviceFailure} from './shoppingSession';

export class EnergyVad {
  samples = 0;
  level = -160;
  private consecutive = 0;
  private voiced = 0;
  private silence = 0;
  private started = false;
  get hasSpeech() { return this.started && this.voiced >= 3200; }
  accept(samples: Int16Array): 'silence' | 'limit' | 'no_speech' | undefined {
    if (!samples.length || samples.length > 320 || this.samples + samples.length > 240_000) throw deviceFailure('invalid_audio');
    let squares = 0; for (const sample of samples) squares += sample * sample;
    this.level = 20 * Math.log10(Math.max(1e-8, Math.sqrt(squares / samples.length) / 32768));
    this.samples += samples.length;
    if (this.level > -40) { this.consecutive += samples.length; this.voiced += samples.length; this.silence = 0; if (this.consecutive >= 960) this.started = true; }
    else { this.consecutive = 0; if (this.started) this.silence += samples.length; }
    if (!this.started && this.samples >= 80_000) return 'no_speech';
    if (this.samples >= 240_000) return 'limit';
    if (this.started && this.silence >= 16_000) return 'silence';
  }
}
export function encodeWav(samples: Int16Array) {
  const bytes = new ArrayBuffer(44 + samples.length * 2); const view = new DataView(bytes);
  for (const [offset, tag] of [[0, 'RIFF'], [8, 'WAVE'], [12, 'fmt '], [36, 'data']] as const) for (let i = 0; i < tag.length; i++) view.setUint8(offset + i, tag.charCodeAt(i));
  view.setUint32(4, bytes.byteLength - 8, true); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, samples[i], true);
  return new Blob([bytes], {type: 'audio/wav'});
}
type RecordingRun = {
  source: Int16Array; vad: EnergyVad; timer?: ReturnType<typeof setTimeout>; terminal: boolean; cancelled: boolean;
  promise: Promise<VoiceRecording>; resolve(value: VoiceRecording): void; reject(error: unknown): void; file?: string;
  finishing?: Promise<void>;
};
export class VoiceWeb extends WebPlugin implements VoiceContract {
  private readonly injected?: MockContext;
  private run?: RecordingRun;
  constructor(context?: MockContext) { super(); this.injected = context; }
  private get context() { return this.injected ?? getMockContext(); }
  async start() {
    if (this.run && !this.run.terminal) throw deviceFailure('busy');
    const failure = this.context.failure('Voice.start'); if (failure) throw failure;
    if (this.context.permission('microphone') !== 'granted') throw deviceFailure('permission_denied', false);
    if (this.context.isOffline()) throw deviceFailure('offline');
    const source = this.context.fixture<Int16Array>('voice');
    if (!(source instanceof Int16Array) || source.length === 0) throw deviceFailure('audio_unavailable');
    let resolve!: RecordingRun['resolve']; let reject!: RecordingRun['reject'];
    const promise = new Promise<VoiceRecording>((ok, fail) => { resolve = ok; reject = fail; });
    void promise.catch(() => undefined);
    const run: RecordingRun = {source, vad: new EnergyVad(), terminal: false, cancelled: false, promise, resolve, reject}; this.run = run;
    await this.notifyListeners('state', {state: 'recording'});
    run.timer = setTimeout(() => this.frame(run), 20);
  }
  private frame(run: RecordingRun) {
    if (run.terminal) return;
    const start = run.vad.samples;
    if (start === run.source.length) { void this.finish(run, 'manual'); return; }
    const reason = run.vad.accept(run.source.subarray(start, Math.min(start + 320, run.source.length, 240_000)));
    void this.notifyListeners('level', {rmsDbfs: run.vad.level});
    if (reason) void this.finish(run, reason);
    else run.timer = setTimeout(() => this.frame(run), 20);
  }
  stop(): Promise<VoiceRecording> {
    const run = this.run; if (!run) return Promise.reject(deviceFailure('not_recording'));
    if (!run.terminal) void this.finish(run, 'manual'); return run.promise;
  }
  private finish(run: RecordingRun, reason: 'silence' | 'limit' | 'manual' | 'no_speech') {
    if (run.finishing) return run.finishing;
    run.terminal = true; clearTimeout(run.timer);
    run.finishing = this.complete(run, reason); return run.finishing;
  }
  private async complete(run: RecordingRun, reason: 'silence' | 'limit' | 'manual' | 'no_speech') {
    if (!run.vad.hasSpeech) {
      await this.notifyListeners('state', {state: 'stopped'});
      await this.notifyListeners('error', {code: 'no_speech', retryable: true}); run.reject(deviceFailure('no_speech')); return;
    }
    try {
      run.file = await getWebRepository().writeBlob(encodeWav(run.source.subarray(0, run.vad.samples)), 'voice');
      if (run.cancelled) { await getWebRepository().discardTemp({file: run.file}); return; }
      const result: VoiceRecording = {file: run.file, durationMs: run.vad.samples / 16, sampleRate: 16000, channels: 1, bitsPerSample: 16};
      await this.notifyListeners('state', {state: 'stopped', reason});
      if (!run.cancelled) { await this.notifyListeners('completed', result); run.resolve(result); }
    } catch {
      if (!run.cancelled) { await this.notifyListeners('state', {state: 'stopped'}); await this.notifyListeners('error', {code: 'io_error', retryable: true}); run.reject(deviceFailure('io_error')); }
    }
  }
  async cancel() {
    const run = this.run; if (!run) return;
    run.cancelled = true; run.terminal = true; clearTimeout(run.timer); run.reject(deviceFailure('cancelled', false));
    await run.finishing;
    if (run.file) await getWebRepository().discardTemp({file: run.file});
    await this.notifyListeners('state', {state: 'stopped', reason: 'cancelled'});
    if (this.run === run) this.run = undefined;
  }
}
export const Voice = registerDevicePlugin<VoiceContract>('Voice', async () => new VoiceWeb());
