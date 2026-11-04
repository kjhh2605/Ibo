"""Generates the BGM, SFX and final mix for the Ibo demo video. Everything is synthesized here."""
import os as _os
VIDEO = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))); REPO = _os.path.dirname(VIDEO); WORK = _os.path.join(VIDEO, '.work')
import json
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
ROOT = _os.path.join(VIDEO, 'audio'); OUT = _os.path.join(WORK, 'audio'); _os.makedirs(OUT, exist_ok=True)
cues = json.load(open(f'{ROOT}/cues.json'))
DUR = cues['duration'] + 0.5
N = int(DUR * SR)
rng = np.random.default_rng(7)


def t_arr(sec):
    return np.arange(int(sec * SR)) / SR


def env_adsr(n, a=0.01, d=0.1, s=0.7, r=0.2, total=None):
    total = total or n / SR
    t = np.arange(n) / SR
    e = np.where(t < a, t / max(a, 1e-4), np.where(t < a + d, 1 - (1 - s) * (t - a) / max(d, 1e-4), s))
    rel_start = total - r
    e = np.where(t > rel_start, e * np.clip(1 - (t - rel_start) / max(r, 1e-4), 0, 1), e)
    return e


def lp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'low')
    return signal.lfilter(b, a, x)


def hp(x, fc, order=2):
    b, a = signal.butter(order, fc / (SR / 2), 'high')
    return signal.lfilter(b, a, x)


def bp(x, lo, hi, order=2):
    b, a = signal.butter(order, [lo / (SR / 2), hi / (SR / 2)], 'band')
    return signal.lfilter(b, a, x)


def add(buf, x, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= buf.shape[0]:
        return
    x = x[: buf.shape[0] - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[i:i + len(x), 0] += x * gain * l * 1.414
    buf[i:i + len(x), 1] += x * gain * r * 1.414


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# ---------------- instruments ----------------
def ep(freq, dur, vel=1.0):
    t = t_arr(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t * 6) + 0.12 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t * 9)
    x *= np.exp(-t * 2.2) * (1 + 0.08 * np.sin(2 * np.pi * 5 * t))
    x *= np.clip(t / 0.004, 0, 1) * np.clip((dur - t) / 0.05, 0, 1)
    return x * vel


def pad(freqs, dur):
    t = t_arr(dur)
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.12, 0.0, 0.11):
            ph = rng.random() * 2 * np.pi
            x += signal.sawtooth(2 * np.pi * f * (1 + det / 100) * t + ph) * 0.33
    x = lp(x, 1400)
    e = np.clip(t / 0.9, 0, 1) * np.clip((dur - t) / 1.0, 0, 1)
    return x * e / len(freqs)


def bass(freq, dur):
    t = t_arr(dur)
    x = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(2 * np.pi * 2 * freq * t)
    x = np.tanh(1.6 * x) * np.clip(t / 0.01, 0, 1) * np.exp(-t * 1.4) * np.clip((dur - t) / 0.04, 0, 1)
    return x


def kick():
    t = t_arr(0.42)
    f = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 8.5) + 0.15 * rng.standard_normal(len(t)) * np.exp(-t * 300)


def snare():
    t = t_arr(0.25)
    n = bp(rng.standard_normal(len(t)), 900, 7000) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
    return 0.8 * n + 0.4 * tone


def hat(open_=False):
    t = t_arr(0.18 if open_ else 0.05)
    return hp(rng.standard_normal(len(t)), 7000) * np.exp(-t * (18 if open_ else 80))


def shaker():
    t = t_arr(0.09)
    return bp(rng.standard_normal(len(t)), 4000, 11000) * np.sin(np.pi * t / 0.09) ** 2


# ---------------- music ----------------
music = np.zeros((N, 2))
BPM = 100
B = 60 / BPM
BAR = 4 * B
# Fmaj9, Am7, Dm9, Bbmaj7 (voicings in midi)
CHORDS = [[53, 57, 60, 64, 67], [57, 60, 64, 67], [50, 57, 60, 64, 65], [46, 53, 57, 62]]
ROOTS = [41, 45, 38, 34]
MEL = [[72, 69, 67, 69], [67, 64, 67, 72], [69, 65, 64, 62], [65, 62, 65, 69]]

def chord_at(bar):
    return bar % 4


START_GROOVE = 37.6
END_GROOVE = 150.0
bars = int(DUR / BAR) + 1
for bar in range(bars):
    t0 = bar * BAR
    c = chord_at(bar)
    if t0 > DUR:
        break
    # pad through everything, quieter during intro
    pg = 0.10 if t0 < 5.5 else 0.12
    if t0 >= END_GROOVE:
        pg = 0.13 * max(0.0, 1 - (t0 - END_GROOVE) / 18)
    add(music, pad([midi(n) for n in CHORDS[c]], BAR + 0.6), t0, pg, 0.0)
    # EP comping: intro sparse, groove full
    if t0 < START_GROOVE:
        for k, n in enumerate(CHORDS[c][1:]):
            add(music, ep(midi(n + 12), 1.4, 0.5), t0 + k * B * 0.5 + (0 if t0 > 5 else 0.3), 0.05, -0.3 + 0.2 * k)
    elif t0 < END_GROOVE:
        for beat in (0, 1.5, 2.5):
            for k, n in enumerate(CHORDS[c][1:]):
                add(music, ep(midi(n + 12), 0.9, 0.7), t0 + beat * B + k * 0.012, 0.045, -0.25 + 0.15 * k)
        # bass
        r = ROOTS[c]
        for beat, ln in ((0, 1.4), (1.5, 0.5), (2, 1.0), (3.5, 0.45)):
            add(music, bass(midi(r + (12 if beat == 3.5 else 0)), ln), t0 + beat * B, 0.20)
        # drums
        for beat in range(4):
            if beat in (0, 2):
                add(music, kick(), t0 + beat * B, 0.42)
            if beat in (1, 3):
                add(music, snare(), t0 + beat * B, 0.13, 0.1)
            for h in (0, 0.5):
                add(music, hat(open_=(h == 0.5 and beat == 3)), t0 + (beat + h) * B, 0.05 if h else 0.035, 0.35)
        if bar % 2 == 1:
            add(music, kick(), t0 + 3.5 * B, 0.25)
        # pluck melody every other phrase
        if (bar // 4) % 2 == 1:
            for k, n in enumerate(MEL[c]):
                add(music, ep(midi(n + 12), 0.5, 0.9), t0 + k * B, 0.03, 0.4)
    # map section: shaker groove (light)
    if 9.0 <= t0 < 31.0:
        for s in range(8):
            add(music, shaker(), t0 + s * B / 2, 0.035 if s % 2 else 0.02, -0.3)
        add(music, bass(midi(ROOTS[c]), BAR), t0, 0.12)
# riser into the reveal
rt = t_arr(1.9)
riser = bp(rng.standard_normal(len(rt)), 500, 6000) * (rt / 1.9) ** 2
add(music, riser, 30.1, 0.18)
# impact at the reveal and the final logo
for ti in (32.6, 146.4):
    tt = t_arr(1.6)
    boom = np.sin(2 * np.pi * (40 + 50 * np.exp(-tt * 10)) * tt) * np.exp(-tt * 3) + lp(rng.standard_normal(len(tt)), 2500) * np.exp(-tt * 6) * 0.4
    add(music, boom, ti, 0.35)
# final sustained chord
add(music, pad([midi(n) for n in CHORDS[0]], 14), 150.0, 0.14)
add(music, ep(midi(72), 4, 0.8), 150.0, 0.06)
# market ambience bed (intro + map + wrap)
amb_t = t_arr(DUR)
amb = lp(np.cumsum(rng.standard_normal(len(amb_t))) * 0.002, 900)
amb = amb - lp(amb, 60)
murmur = bp(rng.standard_normal(len(amb_t)), 250, 1800) * (0.5 + 0.5 * np.abs(np.sin(2 * np.pi * 0.37 * amb_t) * np.sin(2 * np.pi * 0.11 * amb_t + 1)))
bed = amb * 3 + murmur * 0.25
amb_env = np.interp(amb_t, [0, 1.0, 31.0, 32.6, 137.6, 139, 149, 150.5], [0, 1, 1, 0, 0, 0.7, 0.7, 0])
music[:, 0] += bed * amb_env * 0.05
music[:, 1] += np.roll(bed, 2400) * amb_env * 0.05
# master fade in/out
fade = np.interp(np.arange(N) / SR, [0, 0.4, DUR - 4.0, DUR - 0.5], [0, 1, 1, 0])
music *= fade[:, None]

# ---------------- sfx ----------------
def s_pop():
    t = t_arr(0.16); f = 300 + 500 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 22)

def s_pin():
    t = t_arr(0.14); f = 520 + 600 * np.exp(-t * 60)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) + 0.3 * lp(rng.standard_normal(len(t)), 1200) * np.exp(-t * 60)

def s_whoosh():
    t = t_arr(0.7); n = rng.standard_normal(len(t)); out = np.zeros_like(n)
    for i, (lo, hi) in enumerate([(300, 900), (700, 2000), (1500, 4500), (3000, 8000)]):
        seg = bp(n, lo, hi) * np.exp(-((t - 0.12 - i * 0.1) ** 2) / 0.02)
        out += seg
    return out * 0.8

def s_swipe():
    t = t_arr(0.3); return bp(rng.standard_normal(len(t)), 1200, 6000) * np.sin(np.pi * t / 0.3) ** 2 * 0.6

def s_shutter():
    out = np.zeros(int(0.16 * SR))
    for d in (0.0, 0.07):
        t = t_arr(0.04); c = hp(rng.standard_normal(len(t)), 2000) * np.exp(-t * 120)
        i = int(d * SR); out[i:i + len(c)] += c
    return out

def s_tick():
    t = t_arr(0.05); return np.sin(2 * np.pi * 2100 * t) * np.exp(-t * 90) * 0.7

def s_tap():
    t = t_arr(0.05); return lp(rng.standard_normal(len(t)), 3000) * np.exp(-t * 140) * 0.8 + np.sin(2 * np.pi * 1400 * t) * np.exp(-t * 120) * 0.3

def s_ding():
    t = t_arr(1.0); f = 1318.5
    return (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.01 * f * t) * np.exp(-t * 3) + 0.15 * np.sin(2 * np.pi * 3.02 * f * t) * np.exp(-t * 6)) * np.exp(-t * 4.5) * 0.5

def s_chip():
    t = t_arr(0.18); return np.sin(2 * np.pi * 880 * t) * np.exp(-t * 26) * 0.45 + np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 40) * 0.2

def s_success():
    out = np.zeros(int(0.9 * SR))
    for k, n in enumerate((84, 88, 91)):
        x = ep(midi(n), 0.6, 0.8); i = int(k * 0.07 * SR); out[i:i + len(x)] += x
    return out * 0.6

def s_check():
    out = np.zeros(int(0.5 * SR))
    for k, n in enumerate((79, 86)):
        x = ep(midi(n), 0.35, 0.9); i = int(k * 0.08 * SR); out[i:i + len(x)] += x
    return out * 0.8

SFX = {'pop': s_pop, 'pin': s_pin, 'whoosh': s_whoosh, 'swipe': s_swipe, 'shutter': s_shutter, 'tick': s_tick,
       'tap': s_tap, 'ding': s_ding, 'chip': s_chip, 'success': s_success, 'check': s_check}
sfx = np.zeros((N, 2))
for c in cues['cues']:
    x = SFX[c['name']]()
    add(sfx, x / (np.max(np.abs(x)) + 1e-9), c['t'], 0.22 * c['gain'], rng.uniform(-0.2, 0.2))

# ---------------- voice ----------------
VO = [('s1', 6.0), ('s2', 14.3), ('s3', 20.8), ('s4', 25.8), ('s5', 32.8), ('s6', 38.8), ('s7a', 51.4), ('s7q', 53.1),
      ('s7b', 57.3), ('s8', 75.5), ('s9a', 90.6), ('s9b', 99.6), ('s9c', 113.4), ('s10', 124.6), ('s11', 138.8), ('s12', 151.0)]
voice = np.zeros((N, 2))
for key, t0 in VO:
    x, sr = sf.read(f'{ROOT}/vo/{key}.flac')
    if x.ndim > 1:
        x = x.mean(axis=1)
    if sr != SR:
        x = signal.resample_poly(x, SR, sr)
    x = x / (np.sqrt(np.mean(x ** 2)) + 1e-9) * 0.085  # consistent loudness
    if key == 's7q':  # the user's voice query: a touch of "phone mic" colour
        x = bp(x, 180, 6000) * 1.05
    add(voice, x, t0, 1.0)
    print(key, 'ends', round(t0 + len(x) / SR, 2))

# ducking: music follows the voice envelope
v = np.abs(voice.mean(axis=1))
env = signal.lfilter([1 - np.exp(-1 / (0.08 * SR))], [1, -np.exp(-1 / (0.08 * SR))], v)
env = np.clip(env / 0.03, 0, 1)
# smooth release
env = np.maximum.accumulate(env[::-1])[::-1] * 0 + env
env = signal.filtfilt(*signal.butter(1, 2.5 / (SR / 2)), env)
duck = 1 - 0.55 * np.clip(env, 0, 1)

mgain = np.interp(np.arange(N) / SR, [0, 37.0, 38.5, 149.0, 151.0, DUR], [1.0, 1.0, 0.48, 0.48, 0.8, 0.8])
mix = music * (duck * mgain)[:, None] + sfx + voice
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
sf.write(f'{OUT}/music.wav', music / (np.max(np.abs(music)) + 1e-9) * 0.8, SR)
sf.write(f'{OUT}/mix.wav', mix, SR, subtype='PCM_24')
print('done', round(DUR, 2), 'peak', peak)
