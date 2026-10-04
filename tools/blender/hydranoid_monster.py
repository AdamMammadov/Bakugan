"""
Builds the anime Darkus Hydranoid creature (the form it takes after "Bakugan, Brawl!")
and exports public/models/hydranoid/monster.glb.

Run:  python3 tools/blender/hydranoid_monster.py      (needs `pip install bpy`)

The body is a skin-modifier skeleton (torso, long neck, curled tail, four legs) smoothed
with subdivision; armour plates, spikes, claws and the head are added on top.
Blender axes: Z up, the creature faces -Y. Units are metres: it stands ~7.5 m tall.
"""

import math
import os

import bpy  # noqa: I001 — must be imported before bmesh/mathutils
import bmesh
from mathutils import Matrix, Quaternion, Vector

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'hydranoid', 'monster.glb')


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def material(name, hex_color, rough=0.55, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*srgb(hex_color), 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*srgb(emit), 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


def new_object(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


V = Vector

# ------------------------------------------------------------------ skeleton

# polylines: (point, skin radius x, skin radius y). Radius x = width, y = depth/height.
# Measured from the side-view reference: 68 px ≈ 1 m, x → -Y (front), height → Z.
SPINE = [  # hip → chest
    (V((0, 2.1, 4.2)), 1.25, 1.3),
    (V((0, 0.0, 3.95)), 1.25, 1.25),
    (V((0, -2.0, 3.55)), 1.1, 1.15),
]
NECK = [
    (V((0, -2.65, 4.75)), 0.72, 0.75),
    (V((0, -3.05, 5.95)), 0.56, 0.58),
    (V((0, -3.55, 6.75)), 0.47, 0.48),
    (V((0, -4.1, 6.95)), 0.42, 0.42),
]
TAIL = [
    (V((0, 2.95, 5.0)), 0.85, 0.85),
    (V((0.1, 3.8, 3.95)), 0.7, 0.7),
    (V((0.2, 4.35, 2.4)), 0.58, 0.58),
    (V((0.3, 4.25, 0.95)), 0.48, 0.48),
    (V((0.4, 3.45, 0.55)), 0.4, 0.4),
    (V((0.5, 2.6, 1.0)), 0.32, 0.32),
    (V((0.55, 2.3, 1.85)), 0.25, 0.25),
    (V((0.55, 2.45, 2.55)), 0.18, 0.18),
]


def leg(side, front):
    x = 0.95 * side
    if front:
        reach = -0.35 if side > 0 else 0.0  # one front leg strides forward
        return [
            (V((x, -1.9, 3.2)), 0.95, 1.0),
            (V((x * 1.1, -2.55 + reach, 1.85)), 0.58, 0.58),
            (V((x * 1.1, -3.2 + reach, 0.5)), 0.36, 0.36),
            (V((x * 1.1, -3.75 + reach, 0.2)), 0.36, 0.22),
        ]
    back = 0.5 if side > 0 else 0.0
    return [
        (V((x * 1.05, 1.25 + back, 3.7)), 1.25, 1.35),
        (V((x * 1.12, 0.85 + back, 1.8)), 0.72, 0.72),  # knee forward
        (V((x * 1.12, 1.75 + back, 0.55)), 0.38, 0.38),  # hock back
        (V((x * 1.12, 1.25 + back, 0.2)), 0.38, 0.22),
    ]


def build_body(mat):
    bm = bmesh.new()
    radii = {}

    def add_chain(points, start=None):
        prev = start
        for p, rx, ry in points:
            v = bm.verts.new(p)
            radii[v] = (rx, ry)
            if prev is not None:
                bm.edges.new((prev, v))
            prev = v
        return prev

    spine_verts = []
    prev = None
    for p, rx, ry in SPINE:
        v = bm.verts.new(p)
        radii[v] = (rx, ry)
        spine_verts.append(v)
        if prev:
            bm.edges.new((prev, v))
        prev = v
    first, chest = spine_verts[0], spine_verts[-1]
    add_chain(NECK, chest)
    add_chain(TAIL, first)
    for side in (-1, 1):
        add_chain(leg(side, True)[1:], nearest(spine_verts, leg(side, True)[0][0], bm, radii, leg(side, True)[0]))
        add_chain(leg(side, False)[1:], nearest(spine_verts, leg(side, False)[0][0], bm, radii, leg(side, False)[0]))

    ob = new_object('body', bm, mat)
    ob.modifiers.new('skin', 'SKIN')
    me = ob.data
    skin = me.skin_vertices[0].data
    # bmesh verts were written in creation order, so radii order matches
    order = list(radii.values())
    for i, (rx, ry) in enumerate(order):
        skin[i].radius = (rx, ry)
    skin[0].use_root = True
    sub = ob.modifiers.new('subd', 'SUBSURF')
    sub.levels = 2
    apply_all(ob)
    smooth(ob)
    return ob


def nearest(spine_verts, p, bm, radii, entry):
    """Create the leg's hip/shoulder joint vertex and connect it to the nearest spine vertex."""
    v = bm.verts.new(entry[0])
    radii[v] = (entry[1], entry[2])
    best = min(spine_verts, key=lambda s: (s.co - p).length)
    bm.edges.new((best, v))
    return v


# ------------------------------------------------------------------ helpers


def frame_along(points, i):
    """Point, tangent and an 'up' (dorsal) vector at polyline index i."""
    p = points[i][0]
    a = points[max(i - 1, 0)][0]
    b = points[min(i + 1, len(points) - 1)][0]
    t = (b - a).normalized()
    side = V((1, 0, 0))
    up = t.cross(side).normalized()
    if up.z < 0 and abs(t.z) < 0.9:
        up = -up
    if abs(t.z) > 0.9:  # vertical stretch (neck): dorsal side faces +Y (back)
        up = V((0, 1, 0)) if up.y < 0 else up
        up = side.cross(t).normalized()
        if up.y < 0:
            up = -up
    return p, t, up


def resample(points, step):
    """Evenly spaced (point, rx, ry) samples along a polyline."""
    out = []
    for k in range(len(points) - 1):
        p0, rx0, ry0 = points[k]
        p1, rx1, ry1 = points[k + 1]
        n = max(1, int((p1 - p0).length / step))
        for j in range(n):
            f = j / n
            out.append((p0.lerp(p1, f), rx0 + (rx1 - rx0) * f, ry0 + (ry1 - ry0) * f))
    out.append(points[-1])
    return out


def plate(name, centre, tangent, up, radius, length, arc_deg, mat, thick=0.12):
    """A curved armour plate hugging a tube of `radius` around `tangent`, centred on `up`."""
    bm = bmesh.new()
    side = tangent.cross(up).normalized()
    rows = []
    n = 10
    for s in (-0.5, 0.5):
        row = []
        for j in range(n + 1):
            ang = math.radians(-arc_deg / 2 + arc_deg * j / n)
            d = up * math.cos(ang) + side * math.sin(ang)
            row.append(bm.verts.new(centre + tangent * (s * length) + d * radius))
        rows.append(row)
    for j in range(n):
        bm.faces.new((rows[0][j], rows[0][j + 1], rows[1][j + 1], rows[1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_object(name, bm, mat)
    ob.data.update()
    p0 = ob.data.polygons[0]
    if p0.normal.dot(p0.center - centre) < 0:
        ob.data.flip_normals()
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thick
    sol.offset = 1
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width = thick * 0.35
    bev.segments = 2
    apply_all(ob)
    smooth(ob)
    return ob


def spike(name, base, direction, length, width, mat, sides=6, curve=0.0, curve_dir=None):
    """A tapered spike; optional curve bends the tip towards curve_dir."""
    bm = bmesh.new()
    d = direction.normalized()
    q = V((0, 0, 1)).rotation_difference(d)
    segs = 6
    rings = []
    for k in range(segs + 1):
        f = k / segs
        r = width * (1 - f) ** 0.9
        off = d * (length * f)
        if curve and curve_dir is not None:
            off += curve_dir.normalized() * (curve * length * f * f)
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            local = V((math.cos(a) * r, math.sin(a) * r * 0.75, 0))
            ring.append(bm.verts.new(base + off + q @ local))
        rings.append(ring)
    for k in range(segs):
        for j in range(sides):
            bm.faces.new((rings[k][j], rings[k][(j + 1) % sides], rings[k + 1][(j + 1) % sides], rings[k + 1][j]))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = new_object(name, bm, mat)
    return ob


def ellipsoid(name, centre, size, mat, rot=None, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if rot:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot.to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    ob = new_object(name, bm, mat)
    smooth(ob)
    return ob


def join(name, obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def euler(x=0, y=0, z=0):
    from mathutils import Euler

    return Euler((math.radians(x), math.radians(y), math.radians(z))).to_quaternion()


# ------------------------------------------------------------------ build


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SKIN = material('skin', '#4b56c4', rough=0.5)
    ARMOR = material('armor', '#2c3159', rough=0.42)
    PINK = material('pink', '#d4607f', rough=0.38)
    WHITE = material('teeth', '#f1f1f6', rough=0.3)
    MOUTH = material('mouth', '#7a1f3a', rough=0.6)
    EYE = material('eye', '#ff2a3a', rough=0.3, emit='#ff1a2a', strength=6)
    BELLY = material('belly', '#5f6dd8', rough=0.5)

    parts = []
    parts.append(build_body(SKIN))

    # belly plate under the chest
    parts.append(ellipsoid('belly', V((0, -0.6, 3.0)), (1.0, 1.9, 0.8), BELLY))

    # --- dorsal armour plates with pink marks and spikes ----------------------
    k = 0
    for chain, step, arc, spike_every, spike_len in (
        (SPINE, 0.62, 200, 1, 0.9),
        (NECK, 0.5, 190, 2, 0.6),
        (TAIL, 0.42, 200, 2, 0.45),
    ):
        samples = resample(chain, step)
        for i in range(len(samples)):
            p, t, up = frame_along(samples, i)
            r = max(samples[i][1], samples[i][2]) * 1.12
            parts.append(plate(f'plate_{k}', p, t, up, r, step * 1.08, arc, ARMOR, thick=0.07 + r * 0.06))
            side = t.cross(up).normalized()
            # small pink diamond marks on both flanks of each plate
            for s in (-1, 1):
                mp = p + (up * math.cos(math.radians(55)) + side * s * math.sin(math.radians(55))) * (r + 0.07 + r * 0.06)
                mark = ellipsoid(f'mark_{k}_{s}', mp, (0.07 + r * 0.05, 0.03, 0.14 + r * 0.06), PINK, rot=V((0, 0, 1)).rotation_difference(t))
                parts.append(mark)
            if i % spike_every == 0 and 0 < i < len(samples) - 1:
                base = p + up * (r + 0.05)
                parts.append(spike(f'spike_{k}', base, up + (-t) * 0.35, spike_len * (0.6 + r * 0.5), 0.12 + r * 0.12, PINK, curve=0.25, curve_dir=-t))
            k += 1

    # shoulder & hip armour: curved shells over the top of each leg, with big spikes
    for side in (-1, 1):
        for front, spike_len in ((True, 1.7), (False, 2.3)):
            lp = leg(side, front)
            top, knee = lp[0][0], lp[1][0]
            t = (knee - top).normalized()
            out = V((side, 0, 0))
            out = (out - t * out.dot(t)).normalized()
            for j in range(3):
                c = top.lerp(knee, -0.05 + j * 0.3)
                rr = lp[0][1] * (1.18 - j * 0.12)
                parts.append(plate(f'pad_{side}_{front}_{j}', c, t, out, rr, 0.75, 170, ARMOR, thick=0.14))
                for m in (-0.2, 0.25):
                    mp = c + out * (rr + 0.16) + t * m
                    parts.append(ellipsoid(f'pad_mark_{side}_{front}_{j}_{m}', mp, (0.05, 0.1, 0.16), PINK, rot=V((0, 0, 1)).rotation_difference(t)))
            parts.append(spike(f'pad_spike_{side}_{front}', top + out * (lp[0][1] + 0.1) + V((0, 0, 0.5)), V((0.45 * side, 0.5, 1)), spike_len, 0.26, PINK, curve=0.35, curve_dir=V((0, 1, 0))))

    # knee / elbow guards (segmented navy bands) and pink fin on the shins
    for side in (-1, 1):
        for lp in (leg(side, True), leg(side, False)):
            knee, ankle = lp[1][0], lp[2][0]
            t = (ankle - knee).normalized()
            for j in range(3):
                c = knee.lerp(ankle, 0.25 + j * 0.22)
                r = lp[1][1] * (1 - j * 0.15) * 1.05
                fwd = V((0, -1, 0))
                up = (fwd - t * fwd.dot(t)).normalized()
                parts.append(plate(f'guard_{side}_{knee.y}_{j}', c, t, up, r, 0.28, 240, ARMOR, thick=0.08))
            # foot with four toes and pink claws
            foot = lp[3][0]
            parts.append(ellipsoid(f'foot_{side}_{knee.y}', V((foot.x, foot.y - 0.15, 0.24)), (0.5, 0.6, 0.24), SKIN))
            for c in range(4):
                x = foot.x + (c - 1.5) * 0.24
                toe = V((x, foot.y - 0.6 - (0.08 if c in (1, 2) else 0), 0.17))
                parts.append(ellipsoid(f'toe_{side}_{knee.y}_{c}', toe, (0.11, 0.24, 0.13), SKIN))
                parts.append(plate(f'toe_guard_{side}_{knee.y}_{c}', toe + V((0, 0.05, 0)), V((0, 1, 0)), V((0, 0, 1)), 0.13, 0.2, 200, ARMOR, thick=0.04))
                parts.append(spike(f'claw_{side}_{knee.y}_{c}', toe + V((0, -0.2, 0.02)), V((0, -1, -0.35)), 0.45, 0.085, PINK, curve=0.45, curve_dir=V((0, 0, -1))))
        # pink fins on the back of the hind shins
        hp = leg(side, False)
        for j in range(4):
            c = hp[2][0].lerp(hp[1][0], 0.2 + j * 0.18)
            parts.append(spike(f'fin_{side}_{j}', c + V((0, 0.25, 0)), V((0, 1, 0.35)), 0.55 - j * 0.07, 0.1, PINK, sides=4))

    # tail tip: three-pronged pink spikes
    tip_p, tip_t, tip_up = frame_along(TAIL, len(TAIL) - 1)
    for j, d in enumerate((tip_t, tip_t + tip_up * 0.9, tip_t - tip_up * 0.9)):
        parts.append(spike(f'tailtip_{j}', tip_p, d, 0.75 if j == 0 else 0.55, 0.11, PINK, curve=0.2, curve_dir=tip_up))

    head = join('head', build_head(ARMOR, SKIN, PINK, WHITE, MOUTH, EYE))
    pivot = NECK[-1][0]
    for v in head.data.vertices:
        v.co = pivot + (v.co - pivot) * HEAD_SCALE
    parts.append(head)

    body = join('Hydranoid', parts)
    body.name = 'HydranoidMonster'
    return body


HEAD_SCALE = 1.5


def build_head(ARMOR, SKIN, PINK, WHITE, MOUTH, EYE):
    """Dragon head at the end of the neck, facing -Y with the jaws wide open."""
    parts = []
    base = NECK[-1][0]
    H = base + V((0, -0.55, -0.25))  # skull centre
    tilt = euler(-18, 0, 0)

    # skull + snout (upper jaw)
    parts.append(ellipsoid('skull', H, (0.55, 0.65, 0.48), ARMOR, rot=tilt))
    parts.append(ellipsoid('snout', H + V((0, -0.8, -0.02)), (0.33, 0.66, 0.2), ARMOR, rot=euler(-4, 0, 0), seg=8))
    parts.append(ellipsoid('cheek', H + V((0, -0.2, -0.25)), (0.5, 0.55, 0.3), SKIN))
    # lower jaw, dropped open
    jaw_pivot = H + V((0, -0.05, -0.32))
    jaw_rot = euler(32, 0, 0)
    parts.append(ellipsoid('jaw', jaw_pivot + jaw_rot @ V((0, -0.7, -0.08)), (0.32, 0.72, 0.16), ARMOR, rot=jaw_rot))
    parts.append(ellipsoid('mouth', H + V((0, -0.55, -0.42)), (0.26, 0.55, 0.22), MOUTH, rot=euler(15, 0, 0)))
    # teeth on upper and lower jaw
    for s in (-1, 1):
        for j in range(5):
            y = -0.35 - j * 0.2
            parts.append(spike(f'tooth_u_{s}_{j}', H + V((s * (0.27 - j * 0.025), y, -0.2)), V((0, -0.15, -1)), 0.2 - j * 0.015, 0.045, WHITE, sides=4))
            lp = jaw_pivot + jaw_rot @ V((s * (0.24 - j * 0.025), -0.3 - j * 0.2, 0.05))
            parts.append(spike(f'tooth_l_{s}_{j}', lp, jaw_rot @ V((0, -0.1, 1)), 0.17 - j * 0.01, 0.04, WHITE, sides=4))
    # fangs at the tip
    for s in (-1, 1):
        parts.append(spike(f'fang_{s}', H + V((s * 0.13, -1.38, -0.12)), V((0, -0.2, -1)), 0.32, 0.06, PINK, sides=5))
    # red eyes
    for s in (-1, 1):
        parts.append(ellipsoid(f'eye_{s}', H + V((s * 0.44, -0.35, 0.16)), (0.06, 0.13, 0.06), EYE, rot=euler(0, 0, -s * 20)))
        parts.append(ellipsoid(f'brow_{s}', H + V((s * 0.4, -0.3, 0.27)), (0.12, 0.3, 0.06), ARMOR, rot=euler(-10, 0, -s * 25)))
    # big pink nose horn sweeping up and forward
    parts.append(spike('nose_horn', H + V((0, -1.05, 0.15)), V((0, -0.55, 1)), 1.25, 0.16, PINK, curve=-0.35, curve_dir=V((0, -1, 0))))
    # crown of navy spikes swept back
    for j, (dx, dz, ln) in enumerate(((0, 0.4, 1.5), (0.28, 0.36, 1.35), (-0.28, 0.36, 1.35), (0.46, 0.15, 1.05), (-0.46, 0.15, 1.05), (0.2, 0.0, 0.8), (-0.2, 0.0, 0.8))):
        parts.append(spike(f'crown_{j}', H + V((dx, 0.15, dz)), V((dx * 1.2, 0.8, 1.0)), ln, 0.15, ARMOR, sides=5, curve=0.25, curve_dir=V((0, 1, 0))))
    # cheek spikes
    for s in (-1, 1):
        parts.append(spike(f'cheek_spike_{s}', H + V((s * 0.45, 0.0, -0.3)), V((s * 0.8, 0.5, -0.4)), 0.55, 0.1, ARMOR, sides=5))
    return parts


def export(ob):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_apply=True)
    print('wrote', os.path.abspath(OUT), os.path.getsize(OUT) // 1024, 'KB', len(ob.data.polygons), 'faces')


if __name__ == '__main__':
    export(build())
