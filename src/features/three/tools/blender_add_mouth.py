"""
Aggiunge a un personaggio GLB (rig Mixamo, mesh unica "output_unwrapped") le stesse forme del viso del
Professore "parlante" (PRESENTATORE_PARLANTE.glb, preparato in Blender):

  - taglio della linea delle labbra (rip lungo un percorso di spigoli tra gli angoli della bocca);
  - mesh "MouthInterior" scura, dentro la testa dietro le labbra, skinnata all'osso della testa;
  - shape key jawOpen / mouthO / mouthE (traslazione verso il basso del labbro inferiore e del mento,
    con sfumatura laterale e in profondità, + stringere/allargare per O/E), blink (palpebre che
    collassano su una linea), browsUp (sopracciglia su).

Analisi del Professore (analyse*.py): jawOpen = −Z fino a 1.6 cm sotto la linea delle labbra
(pieno da subito sotto il labbro fino a ~9 cm, sfumato verso il collo e lateralmente oltre gli angoli);
mouthO = come jaw al 70 % + labbra in avanti e strette; mouthE = 30 % + allargate; blink = palpebra
superiore giù / inferiore su (±1–1.7 cm); browsUp = +7 mm. Interno bocca: materiale (0.07, 0.008, 0.012).

Uso (Blender 5.2, headless; gli originali in REFERENCE/ non vengono mai toccati):
  blender --background --python blender_add_mouth.py -- REFERENCE/MODELLI-3D/PRESENTATRICE_DONNA.glb <out>/PRESENTATRICE_DONNA_PARLANTE.glb mouth_regina.json
  blender --background --python blender_add_mouth.py -- REFERENCE/MODELLI-3D/PALMINO.glb <out>/PALMINO_PARLANTE.glb mouth_palmino.json
poi ottimizzazione come gli altri GLB (gltf-transform resize + optimize --compress meshopt --texture-compress webp,
i morph target e i targetNames restano) in public/models/regina*.glb e palmino*.glb.
I punti di labbra/occhi/sopracciglia nei JSON sono stati presi dal render frontale di blender_render_face.py.
Coordinate di Blender: X destra, Z su, la faccia guarda −Y. I punti della bocca/occhi sono in pixel
del render frontale ortogonale di render_face.py (centro cx/cz, lato `ortho` metri, 1024 px).
"""
import bpy, bmesh, sys, json, heapq, math
from mathutils import Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index("--") + 1:]
src, dst, cfg_path = argv[0], argv[1], argv[2]
cfg = json.load(open(cfg_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for o in list(bpy.data.objects):
    if o.type == "MESH" and o.name.lower().startswith("ico"):
        bpy.data.objects.remove(o, do_unlink=True)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
obj = bpy.data.objects["output_unwrapped"]
mw = obj.matrix_world.copy()
mwi = mw.inverted()

M = cfg["map"]

# normali originali per angolo (il modello è low-poly con normali "a facce": vanno conservate
# identiche, altrimenti l'ombreggiatura cambia). Si salvano in un attributo per-angolo che bmesh
# trasporta (e interpola) attraverso tagli e separazioni, poi si riapplicano come normali custom.
_me0 = obj.data
_attr = _me0.attributes.new("orig_n", "FLOAT_VECTOR", "CORNER")
_attr.data.foreach_set("vector", [c for cn in _me0.corner_normals for c in cn.vector])


def px2w(u, v):
    return (M["cx"] + (u / M["px"] - 0.5) * M["ortho"], M["cz"] + (0.5 - v / M["px"]) * M["ortho"])


def smooth(e0, e1, x):
    if e1 == e0:
        return 1.0 if x >= e1 else 0.0
    t = max(0.0, min(1.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------------ superficie frontale
me = obj.data
world = []
kd2 = None


def build_kd():
    """indice spaziale (xz) dei vertici della mesh: va ricostruito dopo ogni modifica della topologia."""
    global world, kd2
    world = [mw @ v.co for v in me.vertices]
    kd2 = KDTree(len(world))
    for i, p in enumerate(world):
        kd2.insert(Vector((p.x, 0.0, p.z)), i)
    kd2.balance()


build_kd()


def front_y(x, z, r=0.004):
    """y della superficie più avanzata (min y) vicino a (x, z)."""
    best = None
    for (co, i, d) in kd2.find_range(Vector((x, 0.0, z)), r):
        y = world[i].y
        if best is None or y < best:
            best = y
    if best is None and r < 0.03:
        return front_y(x, z, r * 2)
    return best


# curva delle labbra (x crescente)
lip = sorted([px2w(u, v) for u, v in cfg["lip"]], key=lambda p: p[0])
xl, xr = lip[0][0], lip[-1][0]
xc = (xl + xr) / 2
half = (xr - xl) / 2


def lip_z(x):
    if x <= lip[0][0]:
        return lip[0][1]
    for (x0, z0), (x1, z1) in zip(lip, lip[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0)
            return z0 + (z1 - z0) * t
    return lip[-1][1]


lip_y = {round(x, 4): front_y(x, z) for x, z in lip}
y_mouth = min(v for v in lip_y.values() if v is not None)
print("LIP", xl, xr, "y", y_mouth)

# ------------------------------------------------------------------ taglio delle labbra
bm = bmesh.new()
bm.from_mesh(me)
bm.verts.ensure_lookup_table()
bm.edges.ensure_lookup_table()


def wpos(v):
    return mw @ v.co


def curve_dist(p):
    """distanza (xz) dalla curva delle labbra, 1e9 fuori dagli angoli."""
    if p.x < xl - 0.002 or p.x > xr + 0.002:
        return 1e9
    return abs(p.z - lip_z(p.x))


FRONT_TOL = cfg.get("frontTol", 0.012)
# La mesh è divisa in molte isole UV (vertici duplicati sulle cuciture): niente percorso continuo.
# Si "strappa" invece il confine tra le facce sotto e sopra la curva delle labbra, tra gli angoli:
# ogni spigolo con una faccia sotto e una sopra viene diviso (rip), come il taglio del Professore.
bm.faces.ensure_lookup_table()


def face_side(f):
    c = sum((wpos(v) for v in f.verts), Vector()) / len(f.verts)
    if c.x < xl + 0.001 or c.x > xr - 0.001:
        return 0
    if abs(c.z - lip_z(c.x)) > 0.01:
        return 0
    fy = front_y(c.x, c.z)
    if fy is None or c.y > fy + FRONT_TOL:
        return 0
    return -1 if c.z < lip_z(c.x) else 1


# 1) taglio esatto lungo la curva: ogni faccia attraversata dalla curva (vertici da parti opposte)
#    viene tagliata da un piano verticale (contiene l'asse Y) lungo il tratto di curva più vicino
#    (curva infittita a ~2 mm). Due passate: le facce nate dal primo taglio vengono ricontrollate.
dense = []
for (x0, z0), (x1, z1) in zip(lip, lip[1:]):
    n = max(1, int((x1 - x0) / 0.002))
    for k in range(n):
        t = k / n
        dense.append((x0 + (x1 - x0) * t, z0 + (z1 - z0) * t))
dense.append(lip[-1])


def sgn(p):
    return p.z - lip_z(min(max(p.x, xl), xr))


residual = []
for _pass in range(4):
    groups = {}
    for f in bm.faces:
        ps = [wpos(v) for v in f.verts]
        c = sum(ps, Vector()) / len(ps)
        if c.x < xl or c.x > xr or abs(sgn(c)) > 0.008:
            continue
        sg = [sgn(p) for p in ps]
        if not (min(sg) < -2e-5 and max(sg) > 2e-5):
            continue
        fy = front_y(c.x, c.z)
        if fy is None or c.y > fy + FRONT_TOL:
            continue
        k = min(range(len(dense) - 1), key=lambda q: abs((dense[q][0] + dense[q + 1][0]) / 2 - c.x))
        groups.setdefault(k, []).append(f)
    print("PASS", _pass, "straddling", sum(len(g) for g in groups.values()), [tuple(round(c, 4) for c in (sum((wpos(v) for v in f.verts), Vector()) / len(f.verts))) for g in groups.values() for f in g][:6])
    residual = [f for g in groups.values() for f in g]
    if not groups:
        break
    for k, faces in groups.items():
        (x0, z0), (x1, z1) = dense[k], dense[k + 1]
        nrm = Vector((-(z1 - z0), 0.0, x1 - x0)).normalized()
        geom = set(faces)
        for f in faces:
            geom.update(f.edges)
            geom.update(f.verts)
        co = mwi @ Vector((x0, 0.0, z0))
        no = (mwi.to_3x3() @ nrm).normalized()
        bmesh.ops.bisect_plane(bm, geom=list(geom), dist=1e-7, plane_co=co, plane_no=no)
    bm.faces.ensure_lookup_table()
    bm.verts.ensure_lookup_table()
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bm.faces.ensure_lookup_table()
bm.edges.ensure_lookup_table()
side = {f.index: face_side(f) for f in bm.faces}
e2 = sum(1 for e in bm.edges if len(e.link_faces) == 2 and side[e.link_faces[0].index] != 0)
e1 = sum(1 for e in bm.edges if len(e.link_faces) == 1 and side[e.link_faces[0].index] != 0)
print("MOUTH EDGES manifold", e2, "boundary", e1)
# 2) "rip" lungo la linea: ogni vertice usato sia da facce sotto la linea (fascia tra gli angoli) sia
#    da facce sopra viene separato (bmesh.utils.vert_separate) lungo gli spigoli di confine, così il
#    labbro inferiore si stacca da quello superiore senza toccare UV e pesi. Gli altri bordi della
#    fascia restano cuciti (i pesi lì dipendono solo dalla posizione → nessuna crepa).
lay = bm.verts.layers.int.new("lowerband")
band = set(f.index for f in bm.faces if side[f.index] == -1)


def is_upper(f):
    c = sum((wpos(v) for v in f.verts), Vector()) / len(f.verts)
    return c.z > lip_z(min(max(c.x, xl), xr))


sep = 0
for f in list(bm.faces):
    if f.index in band:
        for v in f.verts:
            v[lay] = 1
# vertici sulla linea (dal taglio): separati lungo ogni spigolo che divide una faccia sopra da una sotto
online = []
for v in bm.verts:
    p = wpos(v)
    if xl + 0.0005 < p.x < xr - 0.0005 and abs(sgn(p)) < 0.0004:
        fy = front_y(p.x, p.z)
        if fy is not None and p.y < fy + FRONT_TOL:
            online.append(v)
for v in online:
    if not v.is_valid:
        continue
    edges = [e for e in v.link_edges if len(e.link_faces) == 2 and is_upper(e.link_faces[0]) != is_upper(e.link_faces[1])]
    if edges:
        bmesh.utils.vert_separate(v, edges)
        sep += 1
bm.verts.ensure_lookup_table()
# residui: vertici non-manifold (ventagli uniti solo dal vertice) e vertici delle poche facce che il
# taglio non è riuscito ad attraversare → separati su tutti gli spigoli (ogni copia segue la sua faccia)
res_verts = set(v for f in residual if f.is_valid for v in f.verts)
for v in list(bm.verts):
    if not v.is_valid or not v.link_faces:
        continue
    p = wpos(v)
    if v not in res_verts and not (xl + 0.0005 < p.x < xr - 0.0005 and abs(sgn(p)) < 0.0004):
        continue
    if len(set(is_upper(ff) for ff in v.link_faces)) == 2:
        bmesh.utils.vert_separate(v, list(v.link_edges))
        sep += 1
bm.verts.ensure_lookup_table()
bm.faces.ensure_lookup_table()
for v in bm.verts:
    v[lay] = 1 if v.link_faces and all(ff.index in band for ff in v.link_faces) else 0
shared = sum(1 for v in bm.verts if v.link_faces and len(set(is_upper(ff) for ff in v.link_faces)) == 2 and xl + 0.0005 < wpos(v).x < xr - 0.0005 and abs(sgn(wpos(v))) < 0.0004)
print("RIP separated", sep, "still shared", shared)
bm.to_mesh(me)
bm.free()
me.update()
for poly in me.polygons:
    poly.use_smooth = True
_on = me.attributes["orig_n"]
_vals = [0.0] * (len(me.loops) * 3)
_on.data.foreach_get("vector", _vals)
me.normals_split_custom_set([Vector(_vals[k * 3:k * 3 + 3]).normalized() for k in range(len(me.loops))])
me.attributes.remove(me.attributes["orig_n"])
me.update()


def _normdev(tag):
    dev = []
    cn = me.corner_normals
    for poly in me.polygons:
        c = mw @ poly.center
        if 1.30 < c.z < 1.45 and c.y < -0.1:
            for li in poly.loop_indices:
                dev.append(poly.normal.angle(Vector(cn[li].vector)))
    print("NORMDEV", tag, len(dev), round(sum(dev) / max(1, len(dev)), 4))


_normdev("after-cut")

# ------------------------------------------------------------------ classificazione e pesi
build_kd()
band_attr = me.attributes.get("lowerband")
in_band = [band_attr.data[k].value == 1 for k in range(len(me.vertices))] if band_attr else [False] * len(me.vertices)
face_z = [0.0] * len(me.vertices)
cnt = [0] * len(me.vertices)
for poly in me.polygons:
    cz_ = sum((world[k].z for k in poly.vertices)) / len(poly.vertices)
    for k in poly.vertices:
        face_z[k] += cz_
        cnt[k] += 1
for k in range(len(face_z)):
    face_z[k] = face_z[k] / cnt[k] if cnt[k] else world[k].z
# vertice con almeno una faccia sopra la linea (nello stesso ventaglio) → resta col labbro superiore
has_upper = [False] * len(world)
for poly in me.polygons:
    c = sum((world[k] for k in poly.vertices), Vector()) / len(poly.vertices)
    if c.z > lip_z(min(max(c.x, xl), xr)):
        for k in poly.vertices:
            has_upper[k] = True

J = cfg["jaw"]
depth, fade, cfade = J["depth"], J["fade"], J["cornerFade"]
lower_w = [0.0] * len(world)
upper_w = [0.0] * len(world)
for k, p in enumerate(world):
    if p.x < xl - cfade or p.x > xr + cfade:
        continue
    fy = front_y(p.x, p.z)
    # solo la parte frontale della testa (capelli/nuca dietro hanno x,z simili ma y opposta)
    if p.y > y_mouth + J.get("backTol", 0.08) or (fy is not None and p.y > fy + 0.03):
        continue
    lz = lip_z(min(max(p.x, xl), xr))
    # laterale: pieno al centro, ~0.35 agli angoli, 0 oltre cornerFade
    u = abs(p.x - xc) / half
    wx = 1.0 - 0.8 * smooth(0.45, 1.0, u)
    if p.x < xl:
        wx *= 1 - smooth(0, cfade, xl - p.x)
    if p.x > xr:
        wx *= 1 - smooth(0, cfade, p.x - xr)
    below = in_band[k] or (not has_upper[k] and p.z < lz + 0.004)
    if below:
        dz = lz - p.z
        wz = 1.0 if dz <= depth else 1 - smooth(depth, depth + fade, dz)
        lower_w[k] = wx * wz
    else:
        dz = p.z - lz
        upper_w[k] = wx * (1 - smooth(0.0, J.get("upperBand", 0.012), dz))

kb_basis = obj.shape_key_add(name="Basis", from_mix=False)


def add_key(name, fn):
    kb = obj.shape_key_add(name=name, from_mix=False)
    for k, p in enumerate(world):
        d = fn(k, p)
        if d is None:
            continue
        kb.data[k].co = mwi @ (p + Vector(d))
    return kb


A = J["amp"]
add_key("jawOpen", lambda k, p: (0.0, A * 0.18 * lower_w[k], -A * lower_w[k]) if lower_w[k] > 0 else None)


def key_o(k, p):
    if lower_w[k] <= 0 and upper_w[k] <= 0:
        return None
    pinch = -(p.x - xc) * 0.22 * max(lower_w[k], upper_w[k])
    fwd = -0.0018 * max(lower_w[k], upper_w[k])
    down = -A * 0.62 * lower_w[k] + 0.0015 * upper_w[k]
    return (pinch, fwd, down)


add_key("mouthO", key_o)

# diagnostica: facce più stirate da jawOpen
jk = obj.data.shape_keys.key_blocks["jawOpen"]
stretch = []
for poly in me.polygons:
    vs = list(poly.vertices)
    d0 = max((world[vs[i]] - world[vs[(i + 1) % len(vs)]]).length for i in range(len(vs)))
    d1 = max(((mw @ jk.data[vs[i]].co) - (mw @ jk.data[vs[(i + 1) % len(vs)]].co)).length for i in range(len(vs)))
    if d1 - d0 > 0.004:
        stretch.append((round(d1 - d0, 4), [(tuple(round(c, 4) for c in world[k]), round(lower_w[k], 2), has_upper[k], in_band[k]) for k in vs]))
stretch.sort(key=lambda t: -t[0])
print("STRETCH", len(stretch))
for st in stretch[:8]:
    print("  ", st)


def key_e(k, p):
    if lower_w[k] <= 0 and upper_w[k] <= 0:
        return None
    widen = (p.x - xc) * 0.10 * max(lower_w[k], upper_w[k])
    return (widen, 0.0008 * max(lower_w[k], upper_w[k]), -A * 0.3 * lower_w[k])


add_key("mouthE", key_e)

# palpebre: la zona dell'occhio collassa su una linea al 30 % dell'altezza, la palpebra superiore la copre
eyes = cfg.get("eyes") or []
EY = []
for e in eyes:
    x0, top = px2w(e["l"], e["top"])
    x1, bot = px2w(e["r"], e["bottom"])
    EY.append({"x0": min(x0, x1), "x1": max(x0, x1), "top": top, "bot": bot, "band": e.get("band", 0.008), "low": e.get("lowBand", 0.005)})


def key_blink(k, p):
    for e in EY:
        if p.x < e["x0"] - 0.006 or p.x > e["x1"] + 0.006:
            continue
        fy = front_y(p.x, p.z)
        if fy is None or p.y > fy + 0.012 or p.y > y_mouth + 0.06:
            continue
        wx = smooth(e["x0"] - 0.006, e["x0"] + 0.002, p.x) * (1 - smooth(e["x1"] - 0.002, e["x1"] + 0.006, p.x))
        close = e["bot"] + 0.3 * (e["top"] - e["bot"])
        if e["bot"] <= p.z <= e["top"]:
            # l'occhio collassa sulla linea di chiusura, un filo dietro la palpebra che scende
            return (0.0, 0.0012 * wx, (close + 0.0012 - p.z) * wx)
        if e["top"] < p.z < e["top"] + e["band"]:
            # palpebra superiore: scende rigida (riga delle ciglia compresa) e sfuma verso il sopracciglio
            f = 1 - smooth(e["top"] + e["band"] * 0.45, e["top"] + e["band"], p.z)
            return (0.0, -0.0015 * wx * f, (close - e["top"]) * f * wx)
        if e["bot"] - e["low"] < p.z < e["bot"]:
            f = 1 - (e["bot"] - p.z) / e["low"]
            return (0.0, 0.0, (close - e["bot"]) * f * wx)
    return None


if EY:
    add_key("blink", key_blink)

brows = cfg.get("brows") or []
BR = []
for br in brows:
    x0, top = px2w(br["l"], br["top"])
    x1, bot = px2w(br["r"], br["bottom"])
    BR.append((min(x0, x1), max(x0, x1), top, bot))


def key_brows(k, p):
    for (x0, x1, top, bot) in BR:
        if p.x < x0 - 0.01 or p.x > x1 + 0.01:
            continue
        fy = front_y(p.x, p.z)
        if fy is None or p.y > fy + 0.012 or p.y > y_mouth + 0.06:
            continue
        wx = smooth(x0 - 0.01, x0 + 0.004, p.x) * (1 - smooth(x1 - 0.004, x1 + 0.01, p.x))
        if bot - 0.006 <= p.z <= top + 0.012:
            wz = smooth(bot - 0.006, bot, p.z) * (1 - smooth(top + 0.004, top + 0.012, p.z))
            return (0.0, 0.0, cfg.get("browAmp", 0.006) * wx * wz)
    return None


if BR:
    add_key("browsUp", key_brows)

# ------------------------------------------------------------------ interno della bocca
cols, rows = 16, 6
z_top_off = 0.003
z_bot_off = A + 0.006
verts, faces = [], []
# profondità della superficie lungo la linea, ammorbidita (niente gradini tra le colonne)
col_x = [xl + 0.001 + (xr - xl - 0.002) * c / cols for c in range(cols + 1)]
col_y = [front_y(x, lip_z(min(max(x, xl), xr))) or y_mouth for x in col_x]
col_y = [sum(col_y[max(0, c - 2):c + 3]) / len(col_y[max(0, c - 2):c + 3]) for c in range(cols + 1)]
for r in range(rows + 1):
    for c in range(cols + 1):
        x = col_x[c]
        lz = lip_z(min(max(x, xl), xr))
        z = lz + z_top_off - (z_top_off + z_bot_off) * r / rows
        # piastra inclinata all'indietro scendendo (segue l'incavo sotto il labbro inferiore)
        fy = col_y[c]
        # verso gli angoli la bocca è sottile: la piastra rientra di più (non buca le guance)
        corner = (abs(x - xc) / half) ** 2
        verts.append((x, fy + cfg.get("interiorInset", 0.007) + 0.006 * corner + 0.7 * max(0.0, lz - z), z))
for r in range(rows):
    for c in range(cols):
        i0 = r * (cols + 1) + c
        faces.append((i0, i0 + 1, i0 + cols + 2, i0 + cols + 1))
mi_me = bpy.data.meshes.new("MouthInterior")
mi_me.from_pydata(verts, [], faces)
mi_me.update()
mat = bpy.data.materials.new("MouthInterior")
mat.diffuse_color = (0.07, 0.008, 0.012, 1.0)
try:
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (0.07, 0.008, 0.012, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.9
except Exception as ex:  # noqa
    print("mat", ex)
mat.use_backface_culling = False
mi_me.materials.append(mat)
mi = bpy.data.objects.new("MouthInterior", mi_me)
bpy.context.scene.collection.objects.link(mi)
mi.parent = arm
mi.matrix_parent_inverse = arm.matrix_world.inverted()
vg = mi.vertex_groups.new(name="mixamorig:Head")
vg.add(list(range(len(verts))), 1.0, "REPLACE")
mod = mi.modifiers.new("Armature", "ARMATURE")
mod.object = arm

print("WEIGHTS lower", sum(1 for w in lower_w if w > 0), "upper", sum(1 for w in upper_w if w > 0))
print("KEYS", [k.name for k in obj.data.shape_keys.key_blocks])

_normdev("before-export")
# ------------------------------------------------------------------ esportazione
bpy.ops.object.select_all(action="DESELECT")
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_morph=True,
    export_morph_normal=False,  # le normali delle shape key verrebbero ricalcolate piatte su tutta la mesh
    export_skins=True,
    export_animations=True,
    export_animation_mode="ACTIONS",
    export_yup=True,
    export_apply=False,
)
print("EXPORTED", dst)
