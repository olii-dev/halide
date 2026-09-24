# Place-only menu thumbnails: perspective view out of the equirect backdrop, centred on the location's car spot (u).
import sys, re, math, numpy as np
from PIL import Image
src = open('src/locations.js').read()
locs = {m.group(1): float(m.group(2)) for m in re.finditer(r"id: '([^']+)'.*?u: ([0-9.]+)", src)}
W, H, FOV, PITCH = 1280, 794, math.radians(78), math.radians(-5)
for lid, u in locs.items():
    if len(sys.argv) > 1 and lid not in sys.argv[1:]: continue
    im = np.asarray(Image.open(f'public/assets/backdrop/{lid}_4k.jpg').convert('RGB')).astype(np.float32); ph, pw = im.shape[:2]
    t = math.tan(FOV / 2); xs = np.linspace(-t, t, W); ys = np.linspace(t * H / W, -t * H / W, H)
    x, y = np.meshgrid(xs, ys); z = np.ones_like(x)
    cp, sp = math.cos(PITCH), math.sin(PITCH); y2 = y * cp + z * sp; z2 = -y * sp + z * cp
    lon = u * 2 * math.pi + np.arctan2(x, z2); lat = np.arctan2(y2, np.hypot(x, z2))
    col = (lon / (2 * math.pi) % 1) * pw - 0.5; row = (0.5 - lat / math.pi) * ph - 0.5
    c0 = np.floor(col).astype(int); r0 = np.clip(np.floor(row).astype(int), 0, ph - 2); fc = (col - c0)[..., None]; fr = (row - r0)[..., None]
    c0 %= pw; c1 = (c0 + 1) % pw
    out = (im[r0, c0] * (1 - fc) + im[r0, c1] * fc) * (1 - fr) + (im[r0 + 1, c0] * (1 - fc) + im[r0 + 1, c1] * fc) * fr
    Image.fromarray(out.clip(0, 255).astype(np.uint8)).resize((640, 397), Image.LANCZOS).save(f'public/assets/thumbs/{lid}.jpg', quality=86)
    print('thumb', lid, u)
