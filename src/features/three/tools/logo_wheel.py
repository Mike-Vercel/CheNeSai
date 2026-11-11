"""Ruota del logo CHE NE SAI?! ridisegnata (spicchi arcobaleno con raggi di luce, puntini, etichette).
uso: python -I wheel.py <font.ttf> <outdir>
"""
import math
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

font_path, out = sys.argv[1], sys.argv[2]
N = 2048
C = N / 2
R = 1000  # raggio degli spicchi (= bordo interno della cornice)

# spicchio 0 centrato in alto (sotto la lampadina-puntatore), poi in senso orario
WEDGES = [
    ("INIZIA GIOCO", (255, 200, 30), True),
    ("CINEMA", (244, 2, 203), False),
    ("MUSICA", (2, 214, 250), False),
    ("SPORT", (251, 147, 3), False),
    ("STORIA", (135, 9, 153), False),
    ("GEOGRAFIA", (61, 190, 24), False),
    ("SCIENZA", (2, 60, 200), False),
    ("ARTE", (248, 11, 121), False),
    ("CUCINA", (255, 214, 0), False),
    ("TV", (0, 83, 247), False),
    ("NATURA", (130, 227, 17), False),
    ("CURIOSITÀ", (232, 7, 247), False),
]
n = len(WEDGES)
step = 2 * math.pi / n
# lo spicchio speciale "INIZIA GIOCO" è più largo (45°) per una scritta grande; gli altri si dividono il resto
SPECIAL = math.radians(45)
OTHER = (2 * math.pi - SPECIAL) / (n - 1)
# bordo iniziale (da ore 12, orario) e centro di ciascuno spicchio
starts = [-SPECIAL / 2] + [SPECIAL / 2 + k * OTHER for k in range(n - 1)]
widths = [SPECIAL] + [OTHER] * (n - 1)
centers = [s0 + w0 / 2 for s0, w0 in zip(starts, widths)]

yy, xx = np.mgrid[0:N, 0:N].astype(np.float32)
dx, dy = xx - C, yy - C
r = np.hypot(dx, dy)
# angolo da "ore 12" in senso orario
ang = (np.arctan2(dx, -dy) + 2 * math.pi) % (2 * math.pi)
rel = (ang + SPECIAL / 2) % (2 * math.pi)  # 0 = bordo sinistro dello spicchio speciale
idx = np.where(rel < SPECIAL, 0, 1 + np.floor((rel - SPECIAL) / OTHER)).astype(int).clip(0, n - 1)
local = np.where(rel < SPECIAL, rel / SPECIAL, ((rel - SPECIAL) % OTHER) / OTHER)  # 0..1 dentro lo spicchio

img = np.zeros((N, N, 4), np.float32)
base = np.array([w[1] for w in WEDGES], np.float32)[idx]
# gradiente radiale: più chiaro verso il centro, saturo al bordo
t = np.clip(r / R, 0, 1)[..., None]
light = np.clip(1.0 - t, 0, 1) ** 1.6
col = base * (0.78 + 0.22 * t) + (255 - base) * light * 0.55
# "raggi di luce" sottili che partono dal centro
rays = (np.sin(ang * 96) * 0.5 + 0.5) ** 18 + (np.sin(ang * 37 + 1.3) * 0.5 + 0.5) ** 30
rays = rays * np.clip(1.15 - t[..., 0] * 1.1, 0, 1)
col = col + 255 * rays[..., None] * 0.16
# bordo scuro morbido lungo i divisori
edge = np.minimum(local, 1 - local)
col = col * (0.72 + 0.28 * np.clip(edge / 0.06, 0, 1))[..., None]
# lampo bianco al centro
col = col + 255 * (np.clip(1 - r / (R * 0.32), 0, 1) ** 2)[..., None] * 0.9
img[..., :3] = np.clip(col, 0, 255)
img[..., 3] = np.clip((R + 1 - r), 0, 1) * 255
wheel = Image.fromarray(img.astype(np.uint8), "RGBA")
d = ImageDraw.Draw(wheel)

# divisori dorati + borchie
for i in range(n):
    a = starts[i] + widths[i]
    x1, y1 = C + R * math.sin(a), C - R * math.cos(a)
    x0, y0 = C + R * 0.2 * math.sin(a), C - R * 0.2 * math.cos(a)
    d.line([(x0, y0), (x1, y1)], fill=(120, 60, 0, 255), width=16)
    d.line([(x0, y0), (x1, y1)], fill=(255, 205, 80, 255), width=8)
    bx, by = C + R * 0.955 * math.sin(a), C - R * 0.955 * math.cos(a)
    d.ellipse([bx - 20, by - 20, bx + 20, by + 20], fill=(150, 80, 0, 255))
    d.ellipse([bx - 15, by - 15, bx + 15, by + 15], fill=(255, 200, 60, 255))
    d.ellipse([bx - 7, by - 9, bx + 3, by - 1], fill=(255, 250, 210, 255))

# fila di puntini bianchi al centro di ogni spicchio (verso il bordo)
for i in range(n):
    a = centers[i]
    for k in range(5):
        rr = R * (0.2 + k * 0.035)
        px, py = C + rr * math.sin(a + widths[i] * 0.28), C - rr * math.cos(a + widths[i] * 0.28)
        s = 6 + k * 1.0
        d.ellipse([px - s, py - s, px + s, py + s], fill=(255, 255, 255, 235))

# etichette GRANDI: la più grande dimensione che lo spicchio consente
OUT = R * 0.955  # estremità esterna del testo
OUT_S = R * 0.87  # spicchio speciale: lascia spazio alla punta del puntatore
DARK = (26, 5, 38, 255)


def chord(r, width):
    return 2 * r * math.sin(width / 2)


def draw_label(lines, size, fill, stroke):
    font = ImageFont.truetype(font_path, size)
    sw = max(6, int(size * 0.13))
    boxes = [font.getbbox(l, stroke_width=sw) for l in lines]
    w = max(b[2] - b[0] for b in boxes)
    lh = int(size * 0.98)
    h = lh * len(lines) + sw
    pad = sw + 14
    layer = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for k, (l, b) in enumerate(zip(lines, boxes)):
        lw = b[2] - b[0]
        x = pad + (w - lw) / 2 - b[0]
        y = pad + k * lh - b[1] + sw * 0.5
        # ombra morbida sotto il testo
        ld.text((x + size * 0.05, y + size * 0.07), l, font=font, fill=(0, 0, 0, 150), stroke_width=sw, stroke_fill=(0, 0, 0, 150))
    layer = layer.filter(ImageFilter.GaussianBlur(size * 0.04))
    ld = ImageDraw.Draw(layer)
    for k, (l, b) in enumerate(zip(lines, boxes)):
        lw = b[2] - b[0]
        x = pad + (w - lw) / 2 - b[0]
        y = pad + k * lh - b[1] + sw * 0.5
        ld.text((x, y), l, font=font, fill=fill, stroke_width=sw, stroke_fill=stroke)
    return layer, w, h


for i, (label, rgb, special) in enumerate(WEDGES):
    a = centers[i]
    wd = widths[i]
    if special:
        # "INIZIA / GIOCO" tangenziale: quando la ruota si ferma (spicchio in alto) si legge in orizzontale
        fill, stroke = (120, 20, 0, 255), (255, 250, 225, 255)
        best = None
        f0 = ImageFont.truetype(font_path, 100)
        w_top = f0.getbbox("INIZIA")[2] / 100
        w_bot = f0.getbbox("GIOCO")[2] / 100
        for size in range(220, 40, -4):
            lh = size * 0.98
            r_top = OUT_S - lh * 0.5  # centro riga esterna
            r_bot = OUT_S - lh * 1.5  # centro riga interna
            ok = w_top * size * 1.12 <= chord(r_top - lh * 0.4, wd) * 0.97 and w_bot * size * 1.12 <= chord(r_bot - lh * 0.4, wd) * 0.97
            if ok:
                layer, w, h = draw_label(["INIZIA", "GIOCO"], size, fill, stroke)
                best = (layer, w, h)
                break
        layer, w, h = best
        rot = layer.rotate(-math.degrees(a), expand=True, resample=Image.BICUBIC)
        rr = OUT_S - h / 2
    else:
        fill, stroke = (255, 255, 255, 255), DARK
        best = None
        for size in range(190, 40, -4):
            layer, w, h = draw_label([label], size, fill, stroke)
            r_in = OUT - w
            if r_in >= R * 0.3 and chord(r_in, wd) >= h * 1.02:
                best = (layer, w, h)
                break
        layer, w, h = best
        # testo lungo il raggio, base verso il bordo
        rot = layer.rotate(90 - math.degrees(a), expand=True, resample=Image.BICUBIC)
        rr = OUT - w / 2
    cx, cy = C + rr * math.sin(a), C - rr * math.cos(a)
    wheel.alpha_composite(rot, (int(cx - rot.width / 2), int(cy - rot.height / 2)))
    print(label, "size ok", w, h)

# brillantini sullo spicchio speciale
sp = Image.new("RGBA", (N, N), (0, 0, 0, 0))
sd = ImageDraw.Draw(sp)
for k, f in enumerate((0.3, 0.86, 0.5)):
    a = -SPECIAL * 0.3 + SPECIAL * 0.3 * k
    px, py = C + R * f * math.sin(a), C - R * f * math.cos(a)
    L = 34
    sd.polygon([(px, py - L), (px + 7, py - 7), (px + L, py), (px + 7, py + 7), (px, py + L), (px - 7, py + 7), (px - L, py), (px - 7, py - 7)], fill=(255, 255, 255, 230))
wheel.alpha_composite(sp)
wheel.save(f"{out}/wheel-2048.png")
wheel.resize((1024, 1024), Image.LANCZOS).save(f"{out}/wheel-1024.png")

# cornice dorata (fissa) — con e senza lampadine
RO = R / 0.868  # raggio esterno
M = int(math.ceil(RO * 2)) + 8
c = M / 2
yy, xx = np.mgrid[0:M, 0:M].astype(np.float32)
rr = np.hypot(xx - c, yy - c)
u = (rr - R) / (RO - R)  # 0 bordo interno, 1 bordo esterno
inside = (u >= -0.02) & (u <= 1.0)
g = np.zeros((M, M, 4), np.float32)
prof = np.clip(np.sin(np.clip(u, 0, 1) * math.pi), 0, 1)
gold_dark = np.array([130, 65, 0], np.float32)
gold = np.array([245, 170, 30], np.float32)
gold_hi = np.array([255, 236, 150], np.float32)
colr = gold_dark + (gold - gold_dark) * prof[..., None] + (gold_hi - gold) * (prof[..., None] ** 6)
# luce dall'alto
shade = 0.85 + 0.15 * (1 - (yy - c) / RO)[..., None] * 0.5
colr = colr * shade
g[..., :3] = np.clip(colr, 0, 255)
g[..., 3] = (np.clip((1.0 - u) * (RO - R), 0, 1) * np.clip((u + 0.02) * (RO - R), 0, 1)) * 255 * inside
ring = Image.fromarray(g.astype(np.uint8), "RGBA")
rd = ImageDraw.Draw(ring)
for rad, wdt, colx in ((R + 2, 10, (110, 50, 0, 255)), (RO - 3, 7, (100, 45, 0, 255))):
    rd.ellipse([c - rad, c - rad, c + rad, c + rad], outline=colx, width=wdt)
ring.save(f"{out}/rim-plain.png")
BULBS = 28
glow = Image.new("RGBA", ring.size, (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
rb = (R + RO) / 2
for k in range(BULBS):
    a = k / BULBS * 2 * math.pi
    bx, by = c + rb * math.sin(a), c - rb * math.cos(a)
    gd.ellipse([bx - 40, by - 40, bx + 40, by + 40], fill=(255, 230, 150, 120))
glow = glow.filter(ImageFilter.GaussianBlur(14))
ring_b = ring.copy()
ring_b.alpha_composite(glow)
bd = ImageDraw.Draw(ring_b)
for k in range(BULBS):
    a = k / BULBS * 2 * math.pi
    bx, by = c + rb * math.sin(a), c - rb * math.cos(a)
    bd.ellipse([bx - 27, by - 27, bx + 27, by + 27], fill=(140, 70, 0, 255))
    bd.ellipse([bx - 22, by - 22, bx + 22, by + 22], fill=(255, 248, 215, 255))
    bd.ellipse([bx - 10, by - 14, bx + 2, by - 4], fill=(255, 255, 255, 255))
ring_b.save(f"{out}/rim-bulbs.png")
print("ok", M, RO, rb, BULBS)
