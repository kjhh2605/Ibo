import json, numpy as np, cv2
from PIL import Image
from rembg import remove, new_session
from scipy import ndimage
F = '/home/user/sfvideo/fixtures-demo'
sess = new_session('isnet-general-use')
cache = {}
def garments(path):
    if path in cache: return cache[path]
    im = Image.open(f'{F}/{path}').convert('RGB'); w, h = im.size
    a = np.array(remove(im, session=sess, only_mask=True)) / 255.0
    K = w / 310.0
    img = cv2.cvtColor(np.array(im), cv2.COLOR_RGB2BGR)
    # garment band: below the hanging rail, above the floor/table
    y0, y1 = int(72 * K), int(300 * K)
    prof = ndimage.uniform_filter1d(a[y0 + int(20 * K):y1 - int(40 * K)].sum(axis=0), int(9 * K))
    # three valleys between four garments
    cuts = []
    for lo, hi in [(55, 125), (130, 195), (205, 270)]:
        lo, hi = int(lo * K), int(hi * K); cuts.append(lo + int(np.argmin(prof[lo:hi])))
    edges = [0] + cuts + [w]
    out = []
    RECTS = {'images/shops/shop-1-items.png': [(14, 122, 70, 226), (118, 180, 70, 286), (170, 252, 70, 222), (238, 310, 70, 260)],
             'images/shops/shop-2-items.png': [(0, 92, 70, 240), (86, 172, 70, 231), (166, 232, 70, 286), (226, 309, 70, 226)]}
    for i in range(4):
        x0, x1 = edges[i], edges[i + 1]
        if path in RECTS: x0, x1, y0, y1 = [int(v * K) for v in RECTS[path][i]]
        else: y0, y1 = int(72 * K), int(300 * K)
        gm = np.full((h, w), cv2.GC_BGD, np.uint8)
        gm[y0:y1, x0:x1] = cv2.GC_PR_BGD
        reg = a[y0:y1, x0:x1].copy()
        sub = gm[y0:y1, x0:x1]
        if path in RECTS:
            cw = x1 - x0; core = np.zeros_like(reg, bool); core[int(25 * K):, int(cw * 0.3):int(cw * 0.7)] = True
            sub[(reg > 0.35) & core] = cv2.GC_PR_FGD
            sub[(reg > 0.85) & core] = cv2.GC_FGD
        else:
            sub[reg > 0.35] = cv2.GC_PR_FGD
            sub[reg > 0.85] = cv2.GC_FGD
        if not ((sub == cv2.GC_PR_FGD) | (sub == cv2.GC_FGD)).any():
            mid = (x1 - x0) // 2; sub[int(30 * K):int(150 * K), max(0, mid - int(10 * K)):mid + int(10 * K)] = cv2.GC_PR_FGD
        bg = np.zeros((1, 65), np.float64); fgm = np.zeros((1, 65), np.float64)
        cv2.grabCut(img, gm, None, bg, fgm, 6, cv2.GC_INIT_WITH_MASK)
        m = (gm == cv2.GC_FGD) | (gm == cv2.GC_PR_FGD)
        m = ndimage.binary_opening(m, iterations=2)
        lab, n = ndimage.label(m)
        if n:
            sizes = ndimage.sum(m, lab, range(1, n + 1)); m = lab == (1 + int(np.argmax(sizes)))
        m = ndimage.binary_fill_holes(ndimage.binary_closing(m, iterations=4))
        ys, xs = np.nonzero(m)
        out.append((m, [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)], [int(np.median(xs)), int(np.median(ys))]))
    cache[path] = out; return out
cases_doc = json.load(open(f'{F}/masks/items/cases.json')); cases = cases_doc['candidates']
for c in cases:
    if not c['mask'].startswith('masks/items/shop-'): continue
    k = int(c['mask'].split('candidate-')[1][0]) - 1
    m, bbox, tap = garments(c['image'])[k]
    Image.fromarray((m * 255).astype(np.uint8), 'L').save(f"{F}/{c['mask']}")
    c['bbox'] = bbox; c['tap'] = tap
json.dump(cases_doc, open(f'{F}/masks/items/cases.json', 'w'), indent=2)
seg = json.load(open(f'{F}/relay/normal/search-segment.01.response.json'))
labels = ['a blue jacket'] * 4
for i, c in enumerate(seg['body']['photos'][0]['candidates']):
    m, bbox, tap = garments('images/shops/shop-1-items.png')[i]
    p = f"{F}/relay/normal/{c['mask']['data']['asset']}"; size = (c['mask']['width'] * 3, c['mask']['height'] * 3); c['mask']['width'], c['mask']['height'] = size
    mi = Image.fromarray((m * 255).astype(np.uint8), 'L').resize(size, Image.NEAREST); mi.save(p)
    ys, xs = np.nonzero(np.array(mi) > 127)
    c['label'] = labels[i]; c['bbox'] = [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1)]
json.dump(seg, open(f'{F}/relay/normal/search-segment.01.response.json', 'w'), indent=2)
# preview
tiles = []
for c in cases:
    if not c['mask'].startswith('masks/items/shop-'): continue
    im = np.array(Image.open(f"{F}/{c['image']}").convert('RGB')).astype(float)
    m = np.array(Image.open(f"{F}/{c['mask']}").convert('L').resize((im.shape[1], im.shape[0]))) > 127
    o = im * 0.25 + 60; o[m] = im[m]; tiles.append(Image.fromarray(o.clip(0, 255).astype(np.uint8)))
tiles = [t.resize((310, 310)) for t in tiles]
W = Image.new('RGB', (310 * 6, 310 * 2), 'white')
for i, t in enumerate(tiles): W.paste(t, ((i % 6) * 310, (i // 6) * 310))
W.save('/home/user/sfvideo/contact/masks2.png'); print('done')
