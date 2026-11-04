"""Builds the demo fixture set used for the video: verification/fixtures plus the overrides in video/fixtures-demo.
Overrides: shop/storefront/capture photos upscaled 3x and one segmentation mask per garment (see upscale_fixtures.py and
segment_garments.py, which produced them). The verification corpus itself is never modified."""
import os, shutil
VIDEO = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); REPO = os.path.dirname(VIDEO)
SRC, OVR, OUT = os.path.join(REPO, 'verification/fixtures'), os.path.join(VIDEO, 'fixtures-demo'), os.path.join(VIDEO, '.work/fixtures-demo')
shutil.rmtree(OUT, ignore_errors=True); shutil.copytree(SRC, OUT)
n = 0
for root, _, files in os.walk(OVR):
    for f in files:
        rel = os.path.relpath(os.path.join(root, f), OVR); os.makedirs(os.path.dirname(os.path.join(OUT, rel)), exist_ok=True)
        shutil.copy(os.path.join(OVR, rel), os.path.join(OUT, rel)); n += 1
print(f'fixtures-demo: {OUT} ({n} overrides)')
