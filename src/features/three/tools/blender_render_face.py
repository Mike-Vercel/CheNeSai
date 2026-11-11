"""Render ortogonale frontale della testa (posa di riposo) per individuare bocca/occhi sulla texture.
Uso: blender --background --python render_face.py -- <file.glb> <out.png> [scala_orto] [shape=valore,...]
Stampa la mappatura pixel → mondo (Blender: X destra, Z su, la faccia guarda −Y)."""
import bpy, sys, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, outpng = argv[0], argv[1]
ortho = float(argv[2]) if len(argv) > 2 else 0.4
shapes = {}
if len(argv) > 3 and argv[3]:
    for kv in argv[3].split(","):
        k, v = kv.split("=")
        shapes[k] = float(v)
center_override = json.loads(argv[4]) if len(argv) > 4 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
if src.endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.import_scene.gltf(filepath=src)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
arm.data.pose_position = "REST"
for o in bpy.data.objects:
    if o.type == "MESH" and o.name.lower().startswith("ico"):
        o.hide_render = True
    if o.type == "MESH" and o.data.shape_keys:
        for kb in o.data.shape_keys.key_blocks[1:]:
            kb.value = shapes.get(kb.name, 0.0)
hb = arm.data.bones.get("mixamorig:Head")
head = arm.matrix_world @ hb.head_local
tail = arm.matrix_world @ hb.tail_local
cz = (head.z + tail.z) / 2 if center_override is None else center_override[1]
cx = 0.0 if center_override is None else center_override[0]

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "FLAT"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = ortho
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
cam.location = Vector((cx, -3.0, cz))
cam.rotation_euler = (1.5707963, 0, 0)
scene.camera = cam
scene.render.filepath = outpng
bpy.ops.render.render(write_still=True)
print("MAP", json.dumps({"cx": cx, "cz": cz, "ortho": ortho, "px": 1024, "head": list(head), "tail": list(tail)}))
