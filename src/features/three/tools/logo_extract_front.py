"""Separa il primo piano (scritte, lampadina, pulsante, orbita, scintille) dalla ruota del logo.
uso: python -I extract.py <logo.webp> <outdir>
"""
import sys
import numpy as np
import cv2
from PIL import Image
from scipy import ndimage as ndi

src, out = sys.argv[1], sys.argv[2]
im = np.array(Image.open(src).convert("RGBA"))
rgb = np.ascontiguousarray(im[..., :3])
alpha = im[..., 3]
h, w = alpha.shape
hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV_FULL).astype(int)
H = hsv[..., 0] * 360 // 256
S = hsv[..., 1]
V = hsv[..., 2]
yy, xx = np.mgrid[0:h, 0:w]

CX, CY = 772.0, 800.0
R_OUT = 646.0  # bordo esterno della ruota (cornice dorata compresa)
r = np.hypot(xx - CX, yy - CY)
disk = r <= R_OUT


def ell(cx, cy, rx, ry):
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1


def box(x0, y0, x1, y1):
    m = np.zeros((h, w), bool)
    m[y0:y1, x0:x1] = True
    return m


k = lambda n: cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (n, n))
dil = lambda m, n: cv2.dilate(m.astype(np.uint8), k(n)) > 0
ero = lambda m, n: cv2.erode(m.astype(np.uint8), k(n)) > 0

# ---------------------------------------------------------------- semi di primo piano
outside = (~disk) & (alpha > 128)
# via i bordi sottili della cornice che sporgono oltre il raggio stimato (archi dorati sottili)
_lab, _n = ndi.label(outside)
_dist = ndi.distance_transform_edt(outside)
_thick = ndi.maximum(_dist, _lab, index=np.arange(1, _n + 1))
_rmean = ndi.mean(r, _lab, index=np.arange(1, _n + 1))
_drop = 1 + np.flatnonzero((_thick < 9) & (_rmean > 600) & (_rmean < 720))
outside = outside & ~np.isin(_lab, _drop)
# arco della cornice in alto a destra (fra lampadina e orbita): oro sottile, non è primo piano
outside = outside & ~((r > 600) & (r < 680) & (xx > 900) & (yy < 430) & (H >= 18) & (H <= 58))

blue = (H >= 200) & (H <= 245) & (S > 140) & (V > 50) & (V < 225)
face = (S < 130) & (V > 170) & (((H >= 180) & (H <= 260)) | (S < 40))
che_box = box(170, 360, 1340, 740)
c = cv2.morphologyEx(((blue | face) & che_box).astype(np.uint8), cv2.MORPH_CLOSE, k(7)) > 0
c = cv2.morphologyEx(c.astype(np.uint8), cv2.MORPH_OPEN, k(11)) > 0  # via i raggi sottili della ruota
lab, n = ndi.label(c)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
che = ndi.binary_fill_holes(np.isin(lab, 1 + np.flatnonzero(sizes > 20000)))

yellow = (H >= 35) & (H <= 62) & (S > 140) & (V > 190)
sai_box = box(90, 560, 1560, 1180)
lab, n = ndi.label(yellow & sai_box)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
big = np.isin(lab, 1 + np.flatnonzero(sizes > 6000))
sai_core = big
purple = (H >= 262) & (H <= 320) & (S > 100) & (V > 50) & (V < 245)
sai_border = purple & dil(big, 70) & sai_box

bulb = ell(800, 135, 150, 150) | (ell(800, 270, 92, 115) & (yy >= 200)) | box(728, 230, 872, 385)
button = ell(805, 1255, 210, 125) | ell(805, 1372, 292, 108) | box(600, 1250, 1010, 1340)
rays_box = box(545, 1080, 1080, 1220)
rays = rays_box & (H >= 38) & (H <= 60) & (S > 150) & (V > 200)
rays = ndi.binary_opening(rays, iterations=1)

fg_sure = outside | ero(che, 5) | ero(sai_core, 5) | ero(bulb, 18) | ero(button, 18) | rays | ero(sai_border, 3)
fg_maybe = dil(che, 4) | dil(sai_core, 22) | dil(sai_border, 6) | dil(bulb, 4) | dil(button, 4) | dil(rays, 5)

# l'orbita (anello azzurro/viola) entra nella ruota: zona incerta attorno ai pezzi esterni
orbit_seed = outside & (H >= 170) & (H <= 320) & (S > 90)
orbit_zone = dil(orbit_seed, 120) & disk & (H >= 165) & (H <= 325) & (S > 80)

# ---------------------------------------------------------------- semi di sfondo (ruota)
wheel_far = disk & ~dil(fg_maybe | orbit_zone, 26)
bg_sure = wheel_far | (alpha < 10)

mask = np.full((h, w), cv2.GC_PR_BGD, np.uint8)
mask[fg_maybe | orbit_zone] = cv2.GC_PR_FGD
mask[bg_sure] = cv2.GC_BGD
mask[fg_sure] = cv2.GC_FGD

bgd = np.zeros((1, 65), np.float64)
fgd = np.zeros((1, 65), np.float64)
bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
cv2.grabCut(bgr, mask, None, bgd, fgd, 6, cv2.GC_INIT_WITH_MASK)
fg = (mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD)

# pulizia: niente isolette, buchi piccoli chiusi
lab, n = ndi.label(fg)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
fg = np.isin(lab, 1 + np.flatnonzero(sizes > 400)) | outside
fg = ndi.binary_fill_holes(fg) & ~(disk & ~fg & ~ndi.binary_fill_holes(fg)) if False else fg
holes = ndi.binary_fill_holes(fg) & ~fg
lab, n = ndi.label(holes)
sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
fg = fg | np.isin(lab, 1 + np.flatnonzero(sizes < 250))

# bordo morbido (1.5 px) e alfa originale
soft = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 1.2)
a = (soft * alpha.astype(np.float32)).clip(0, 255).astype(np.uint8)
front = np.dstack([rgb, a])
Image.fromarray(front).save(f"{out}/logo-front-full.png")
np.save(f"{out}/fgmask.npy", fg)

# anteprime
def preview(bgc, name):
    bgimg = np.zeros((h, w, 3), np.float32) + np.array(bgc, np.float32)
    af = a[..., None] / 255.0
    comp = rgb * af + bgimg * (1 - af)
    Image.fromarray(comp.astype(np.uint8)).resize((800, 745)).save(f"{out}/{name}")

preview((0, 200, 80), "front_on_green.png")
seeds = np.zeros((h, w, 3), np.uint8)
seeds[mask == cv2.GC_FGD] = (0, 255, 0)
print("done", fg.mean())
