import os as _os
VIDEO = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))); REPO = _os.path.dirname(VIDEO); WORK = _os.path.join(VIDEO, '.work')
import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro(_os.path.join(WORK, 'tts/kokoro-v1.0.onnx'), _os.path.join(WORK, 'tts/voices-v1.0.bin'))
out = {}
for key, voice, text in json.load(open(_os.path.join(VIDEO, 'tts/lines.json'))):
    samples, sr = k.create(text, voice=voice, speed=1.0, lang='en-us')
    # trim leading/trailing silence
    a = np.abs(samples); idx = np.where(a > 0.01)[0]
    samples = samples[max(0, idx[0]-int(0.03*sr)): idx[-1]+int(0.08*sr)]
    sf.write(_os.path.join(VIDEO, f'audio/vo/{key}.flac'), samples, sr, format='FLAC')
    out[key] = round(len(samples)/sr, 3); print(key, out[key], flush=True)
json.dump(out, open(_os.path.join(VIDEO, 'audio/vo/durations.json'), 'w'), indent=1)
