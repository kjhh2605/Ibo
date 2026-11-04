import json, soundfile as sf, numpy as np
from kokoro_onnx import Kokoro
k = Kokoro('/home/user/sfvideo/tts/kokoro-v1.0.onnx', '/home/user/sfvideo/tts/voices-v1.0.bin')
out = {}
for key, voice, text in json.load(open('/home/user/sfvideo/tts/lines.json')):
    samples, sr = k.create(text, voice=voice, speed=1.0, lang='en-us')
    # trim leading/trailing silence
    a = np.abs(samples); idx = np.where(a > 0.01)[0]
    samples = samples[max(0, idx[0]-int(0.03*sr)): idx[-1]+int(0.08*sr)]
    sf.write(f'/home/user/sfvideo/audio/vo/{key}.wav', samples, sr)
    out[key] = round(len(samples)/sr, 3); print(key, out[key], flush=True)
json.dump(out, open('/home/user/sfvideo/audio/vo/durations.json', 'w'), indent=1)
