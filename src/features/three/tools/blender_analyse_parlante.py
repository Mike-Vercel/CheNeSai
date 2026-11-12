"""Analisi headless: PRESENTATORE_PARLANTE.glb contro PRESENTATORE.glb (forme del viso, interno bocca)."""
import bpy, sys, json
from mathutils import Vector

REF = r"C:\Users\micha\Desktop\LAVORO\SARA_MANNINA\QUIZZONE\REFERENCE\GIOCHI\CHE_NE_SAI\MODELLI-3D"
out = {}

def load(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=f"{REF}\\{name}")

def describe(tag):
    info = {"objects": []}
    for o in bpy.data.objects:
        d = {"name": o.name, "type": o.type, "parent": o.parent.name if o.parent else None, "hide": o.hide_get() or o.hide_render}
        if o.type == "MESH":
            me = o.data
            d["verts"] = len(me.vertices)
            d["faces"] = len(me.polygons)
            d["materials"] = [m.name if m else None for m in me.materials]
            d["vgroups"] = len(o.vertex_groups)
            d["mods"] = [(m.type, getattr(m, "object", None) and m.object.name) for m in o.modifiers]
            mw = o.matrix_world
            xs = [mw @ v.co for v in me.vertices]
            if xs:
                d["bbox"] = [[round(min(p[i] for p in xs), 4) for i in range(3)], [round(max(p[i] for p in xs), 4) for i in range(3)]]
            if me.shape_keys:
                basis = me.shape_keys.key_blocks[0]
                keys = {}
                for kb in me.shape_keys.key_blocks[1:]:
                    moved = []
                    for i, (a, b) in enumerate(zip(basis.data, kb.data)):
                        dv = b.co - a.co
                        if dv.length > 1e-5:
                            moved.append((i, dv.length, mw @ a.co, (mw.to_3x3() @ dv)))
                    if moved:
                        mx = max(moved, key=lambda m: m[1])
                        cen = sum((m[2] for m in moved), Vector()) / len(moved)
                        avgd = sum((m[3] for m in moved), Vector()) / len(moved)
                        lo = [round(min(m[2][i] for m in moved), 4) for i in range(3)]
                        hi = [round(max(m[2][i] for m in moved), 4) for i in range(3)]
                        keys[kb.name] = {"n": len(moved), "max": round(mx[1], 5), "center": [round(c, 4) for c in cen], "avgDelta": [round(c, 5) for c in avgd], "box": [lo, hi]}
                    else:
                        keys[kb.name] = {"n": 0}
                d["shapeKeys"] = keys
            # gruppi di vertici con peso sulla mesh (prime ossa)
            if o.vertex_groups and o.name.lower().startswith("mouth"):
                counts = {}
                for v in me.vertices:
                    for g in v.groups:
                        if g.weight > 0.01:
                            counts[o.vertex_groups[g.group].name] = counts.get(o.vertex_groups[g.group].name, 0) + 1
                d["weights"] = counts
            if o.name.lower().startswith("mouth") or o.name.lower().startswith("ico"):
                d["mat_detail"] = []
                for m in me.materials:
                    if m and m.use_nodes:
                        bsdf = m.node_tree.nodes.get("Principled BSDF")
                        if bsdf:
                            d["mat_detail"].append(list(bsdf.inputs["Base Color"].default_value))
        if o.type == "ARMATURE":
            arm = o.data
            for bn in ("mixamorig:Head", "mixamorig:Neck", "headfront", "mixamorigHead"):
                b = arm.bones.get(bn)
                if b:
                    d[bn] = {"head": [round(c, 4) for c in (o.matrix_world @ b.head_local)], "tail": [round(c, 4) for c in (o.matrix_world @ b.tail_local)]}
            d["nbones"] = len(arm.bones)
        info["objects"].append(d)
    out[tag] = info

load("PRESENTATORE_PARLANTE.glb")
describe("parlante")
load("PRESENTATORE.glb")
describe("base")
open(sys.argv[-1], "w").write(json.dumps(out, indent=1, default=str))
