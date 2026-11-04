"""Step 1 of the demo fixture set: copy verification/fixtures to fixtures-demo and upscale shop/storefront/capture photos 3x.
The verification corpus itself is never modified. Wardrobe and self photos stay as-is (native mask fixtures pin their hash and size)."""
import os as _os
VIDEO = _os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))); REPO = _os.path.dirname(VIDEO); WORK = _os.path.join(VIDEO, '.work')
import glob, shutil
from PIL import Image, ImageFilter
SRC = _os.path.join(REPO, 'verification/fixtures'); F = _os.path.join(WORK, 'fixtures-demo')
shutil.rmtree(F, ignore_errors=True); shutil.copytree(SRC, F)
paths = glob.glob(f'{F}/images/shops/*.png') + glob.glob(f'{F}/images/storefronts/*.png') + glob.glob(f'{F}/capture/*.png') + [f'{F}/relay/normal/assets/shop-2-items.png', f'{F}/relay/normal/assets/shop-1.png']
for p in paths:
    im = Image.open(p).convert('RGB'); w, h = im.size
    im.resize((w * 3, h * 3), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2)).save(p)
