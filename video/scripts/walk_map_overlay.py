import json, math, os, shutil
from PIL import Image, ImageDraw
MD = json.loads(open('/home/user/sfvideo/comp/mapdata.js').read().split('=', 1)[1].rstrip(';\n'))
R = MD['paths']['back']; P2 = MD['pins']['p2']
MAP = Image.open('/home/user/sfvideo/comp/assets/dongmyo-map.png').convert('RGB')  # 2x of world
SHOTS = '/home/user/sfvideo/shots'
# (file, box x0,y0,x1,y1 in screenshot px, top clipped?, progress along route)
JOBS = [('08-walk-route', (38, 724, 786, 1644), False, 0.0), ('08b-walk-route-scrolled', (38, 96, 786, 644), True, 0.0),
        ('08c-walk-direction', (38, 96, 786, 524), True, 0.86), ('08d-walk-nearby', (38, 96, 786, 524), True, 0.95),
        ('08f-walk-arrived', (38, 96, 786, 245), True, 1.0)]
def along(f):
    seg = [math.dist(R[i], R[i + 1]) for i in range(len(R) - 1)]; L = sum(seg); d = f * L
    for i, s in enumerate(seg):
        if d <= s or i == len(seg) - 1:
            t = 0 if s == 0 else min(1, d / s); return (R[i][0] + (R[i + 1][0] - R[i][0]) * t, R[i][1] + (R[i + 1][1] - R[i][1]) * t)
        d -= s
xs = [p[0] for p in R]; ys = [p[1] for p in R]
cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
rw, rh = max(xs) - min(xs), max(ys) - min(ys)
for name, (x0, y0, x1, y1), clipped, f in JOBS:
    src = f'{SHOTS}/{name}.png'; orig = f'{SHOTS}/{name}.orig.png'
    if not os.path.exists(orig): shutil.copy(src, orig)
    shot = Image.open(orig).convert('RGB'); bw, bh = x1 - x0, y1 - y0
    pad = 150
    s = min(bw / (rw + 2 * pad), bh / (rh + 2 * pad)) if not clipped or bh > 300 else bw / (rw + 2 * pad) * 0.9
    s = min(s, 1.6)
    # for the arrived/nearby states, keep the destination in view
    fx, fy = (cx, cy)
    if f >= 0.86: fx, fy = (P2[0] * 0.6 + along(f)[0] * 0.4, P2[1] * 0.6 + along(f)[1] * 0.4)
    SS = 3  # supersample
    W, H = bw * SS, bh * SS
    k = s * SS  # output px per world px
    left, top = fx - (bw / 2) / s, fy - (bh / 2) / s
    crop = MAP.crop((int(left * 2), int(top * 2), int((left + bw / s) * 2), int((top + bh / s) * 2))).resize((W, H), Image.LANCZOS)
    d = ImageDraw.Draw(crop)
    T = lambda p: ((p[0] - left) * k, (p[1] - top) * k)
    pts = [T(p) for p in R]
    d.line(pts, fill=(255, 255, 255), width=int(15 * SS), joint='curve')
    d.line(pts, fill=(52, 80, 122), width=int(9 * SS), joint='curve')
    for p in (pts[0], pts[-1]):
        d.ellipse([p[0] - 7.5 * SS, p[1] - 7.5 * SS, p[0] + 7.5 * SS, p[1] + 7.5 * SS], fill=(255, 255, 255))
        d.ellipse([p[0] - 4.5 * SS, p[1] - 4.5 * SS, p[0] + 4.5 * SS, p[1] + 4.5 * SS], fill=(52, 80, 122))
    # destination pin
    px, py = T(P2); r = 21 * SS
    d.polygon([(px - r * 0.75, py - r * 1.3), (px + r * 0.75, py - r * 1.3), (px, py)], fill=(52, 80, 122))
    d.ellipse([px - r, py - r * 2.4, px + r, py - r * 0.4], fill=(52, 80, 122))
    d.ellipse([px - r * 0.4, py - r * 1.8, px + r * 0.4, py - r * 1.0], fill=(241, 235, 223))
    # current position
    ux, uy = T(along(f)) if f < 1 else (px, py + 4 * SS)
    d.ellipse([ux - 22 * SS, uy - 22 * SS, ux + 22 * SS, uy + 22 * SS], fill=(196, 208, 226))
    d.ellipse([ux - 12 * SS, uy - 12 * SS, ux + 12 * SS, uy + 12 * SS], fill=(255, 255, 255))
    d.ellipse([ux - 8.5 * SS, uy - 8.5 * SS, ux + 8.5 * SS, uy + 8.5 * SS], fill=(47, 85, 164))
    tile = crop.resize((bw, bh), Image.LANCZOS)
    mask = Image.new('L', (bw * SS, bh * SS), 0); md = ImageDraw.Draw(mask); rad = 28 * SS
    md.rounded_rectangle([0, -rad * 2 if clipped else 0, bw * SS - 1, bh * SS - 1], radius=rad, fill=255)
    mask = mask.resize((bw, bh), Image.LANCZOS)
    shot.paste(tile, (x0, y0), mask)
    shot.save(src); print(name, 'scale', round(s, 2))
