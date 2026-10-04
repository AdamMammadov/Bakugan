"""
Builds the anime Darkus Hydranoid creature (the form it takes after "Bakugan, Brawl!")
and exports public/models/hydranoid/monster.glb.

Run:  python3 tools/blender/hydranoid_monster.py      (needs `pip install bpy`)

The body is built from skin-modifier tubes (torso, long neck, curled tail, four legs) smoothed
with subdivision; armour plates, spikes, claws and the head are added on top. Each moving part
hangs under a named pivot node (torso, neck, head, jaw, tail, tail_tip, leg_fl/fr/bl/br) so
the web app can animate attacks without a skeleton.
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


def build_skin(name, points, mat):
    """A smooth tube through `points` (skin modifier + subdivision)."""
    bm = bmesh.new()
    prev = None
    for p, _, _ in points:
        v = bm.verts.new(p)
        if prev is not None:
            bm.edges.new((prev, v))
        prev = v
    ob = new_object(name, bm, mat)
    ob.modifiers.new('skin', 'SKIN')
    skin = ob.data.skin_vertices[0].data
    for i, (_, rx, ry) in enumerate(points):
        skin[i].radius = (rx, ry)
    skin[0].use_root = True
    sub = ob.modifiers.new('subd', 'SUBSURF')
    sub.levels = 2
    apply_all(ob)
    smooth(ob)
    return ob


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


def group(name, at, parent=None, parent_at=None):
    """An empty used as an animation pivot, placed at world position `at`."""
    e = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(e)
    e.location = at - (parent_at if parent_at is not None else V((0, 0, 0)))
    if parent is not None:
        e.parent = parent
    return e


def attach(name, objs, grp, grp_at):
    """Joins world-space meshes into one and hangs it under the pivot `grp` (at `grp_at`)."""
    ob = join(name, objs)
    ob.location = -grp_at
    ob.parent = grp
    return ob


def wedge(name, centre, size, mat, taper=(1.0, 1.0), rot=None, bevel=0.09):
    """A box tapered towards -Y (the front): angular armour shapes for the head."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    for v in bm.verts:
        x, y, z = v.co
        if y < 0:
            x *= taper[0]
            z *= taper[1]
        v.co = V((x * size[0], y * size[1], z * size[2]))
    if rot:
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot.to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    ob = new_object(name, bm, mat)
    if bevel:
        b = ob.modifiers.new('bevel', 'BEVEL')
        b.width = bevel
        b.segments = 3
        apply_all(ob)
    smooth(ob)
    return ob


def dorsal(prefix, chain, step, arc, spike_every, spike_len, ARMOR, PINK, BELLY=None, belly_arc=0):
    """Armour plates along a chain's back, pink flank marks, spikes, and optional belly scutes."""
    parts = []
    samples = resample(chain, step)
    for i in range(len(samples)):
        p, t, up = frame_along(samples, i)
        r = max(samples[i][1], samples[i][2]) * 1.12
        parts.append(plate(f'{prefix}_plate_{i}', p, t, up, r, step * 1.08, arc, ARMOR, thick=0.07 + r * 0.06))
        side = t.cross(up).normalized()
        for s in (-1, 1):
            mp = p + (up * math.cos(math.radians(58)) + side * s * math.sin(math.radians(58))) * (r + 0.07 + r * 0.06)
            parts.append(ellipsoid(f'{prefix}_mark_{i}_{s}', mp, (0.07 + r * 0.05, 0.03, 0.14 + r * 0.06), PINK, rot=V((0, 0, 1)).rotation_difference(t)))
        if spike_every and i % spike_every == 0 and 0 < i < len(samples) - 1:
            base = p + up * (r + 0.05)
            parts.append(spike(f'{prefix}_spike_{i}', base, up + (-t) * 0.35, spike_len * (0.6 + r * 0.5), 0.12 + r * 0.12, PINK, curve=0.25, curve_dir=-t))
        if BELLY is not None:
            parts.append(plate(f'{prefix}_scute_{i}', p, t, -up, r * 0.93, step * 0.95, belly_arc, BELLY, thick=0.05))
    return parts


HEAD_SCALE = 1.5
JAW_OPEN = 24  # degrees the jaw is modelled open; the viewer animates around this


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SKIN = material('skin', '#4b56c4', rough=0.5)
    ARMOR = material('armor', '#2c3159', rough=0.42)
    PINK = material('pink', '#d4607f', rough=0.38)
    WHITE = material('teeth', '#f1f1f6', rough=0.3)
    MOUTH = material('mouth', '#7a1f3a', rough=0.6)
    EYE = material('eye', '#ff2a3a', rough=0.3, emit='#ff1a2a', strength=6)
    BELLY = material('belly', '#6878de', rough=0.5)

    O = V((0, 0, 0))
    root = group('HydranoidMonster', O)
    torso = group('torso', O, root, O)

    # --- torso -------------------------------------------------------------------
    tp = [build_skin('spine', SPINE, SKIN)]
    tp.append(ellipsoid('belly', V((0, -0.6, 3.0)), (1.0, 1.9, 0.8), BELLY))
    tp += dorsal('spine', SPINE, 0.62, 200, 1, 0.9, ARMOR, PINK, BELLY, 110)
    for side in (-1, 1):
        for front, spike_len in ((True, 1.8), (False, 2.4)):
            lp = leg(side, front)
            top, knee = lp[0][0], lp[1][0]
            t = (knee - top).normalized()
            out = V((side, 0, 0))
            out = (out - t * out.dot(t)).normalized()
            # one big angular shoulder / hip plate with a smaller one overlapping below
            for j, (f, rr, ln) in enumerate(((0.05, 1.22, 1.5), (0.38, 1.08, 0.9))):
                c = top.lerp(knee, f)
                r = lp[0][1] * rr
                tp.append(plate(f'pad_{side}_{front}_{j}', c, t, out, r, ln, 200, ARMOR, thick=0.16))
                for m in (-0.25, 0.25):
                    mp = c + out * (r + 0.18) + t * m * ln * 0.6
                    tp.append(ellipsoid(f'pad_mark_{side}_{front}_{j}_{m}', mp, (0.05, 0.11, 0.2), PINK, rot=V((0, 0, 1)).rotation_difference(t)))
            tp.append(spike(f'pad_spike_{side}_{front}', top + out * (lp[0][1] + 0.15) + V((0, 0, 0.55)), V((0.45 * side, 0.5, 1)), spike_len, 0.28, PINK, curve=0.35, curve_dir=V((0, 1, 0))))
    attach('torso_mesh', tp, torso, O)

    # --- neck → head → jaw ----------------------------------------------------------
    chest = SPINE[-1][0]
    neck = group('neck', chest, torso, O)
    neck_chain = [SPINE[-1]] + NECK
    np_ = [build_skin('neck_skin', neck_chain, SKIN)]
    np_ += dorsal('neck', NECK, 0.5, 190, 2, 0.6, ARMOR, PINK, BELLY, 120)
    attach('neck_mesh', np_, neck, chest)

    head_at = NECK[-1][0]
    head_parts, jaw_parts, jaw_pivot = build_head(ARMOR, SKIN, PINK, WHITE, MOUTH, EYE)
    for ob in head_parts + jaw_parts:
        for v in ob.data.vertices:
            v.co = head_at + (v.co - head_at) * HEAD_SCALE
    jaw_pivot = head_at + (jaw_pivot - head_at) * HEAD_SCALE
    head = group('head', head_at, neck, chest)
    attach('head_mesh', head_parts, head, head_at)
    jaw = group('jaw', jaw_pivot, head, head_at)
    attach('jaw_mesh', jaw_parts, jaw, jaw_pivot)

    # --- tail (two segments so it can whip) ----------------------------------------
    hip = SPINE[0][0]
    tail = group('tail', hip, torso, O)
    t1 = [SPINE[0]] + TAIL[:4]
    tl = [build_skin('tail_skin', t1, SKIN)] + dorsal('tail', TAIL[:4], 0.42, 200, 2, 0.45, ARMOR, PINK)
    attach('tail_mesh', tl, tail, hip)
    mid = TAIL[3][0]
    tail_tip = group('tail_tip', mid, tail, hip)
    t2 = TAIL[3:]
    tt = [build_skin('tail_tip_skin', t2, SKIN)] + dorsal('tailtip', t2, 0.4, 200, 2, 0.4, ARMOR, PINK)
    tip_p, tip_t, tip_up = frame_along(TAIL, len(TAIL) - 1)
    for j, d in enumerate((tip_t, tip_t + tip_up * 0.9, tip_t - tip_up * 0.9)):
        tt.append(spike(f'tailtip_{j}', tip_p, d, 0.75 if j == 0 else 0.55, 0.11, PINK, curve=0.2, curve_dir=tip_up))
    attach('tail_tip_mesh', tt, tail_tip, mid)

    # --- legs ------------------------------------------------------------------------
    for side in (-1, 1):
        for front in (True, False):
            lp = leg(side, front)
            name = f"leg_{'f' if front else 'b'}{'l' if side < 0 else 'r'}"
            top = lp[0][0]
            g = group(name, top, torso, O)
            parts = [build_skin(f'{name}_skin', lp, SKIN)]
            knee, ankle = lp[1][0], lp[2][0]
            t = (ankle - knee).normalized()
            for j in range(3):
                c = knee.lerp(ankle, 0.25 + j * 0.22)
                r = lp[1][1] * (1 - j * 0.15) * 1.05
                fwd = V((0, -1, 0))
                up = (fwd - t * fwd.dot(t)).normalized()
                parts.append(plate(f'{name}_guard_{j}', c, t, up, r, 0.28, 240, ARMOR, thick=0.08))
            foot = lp[3][0]
            parts.append(ellipsoid(f'{name}_foot', V((foot.x, foot.y - 0.15, 0.24)), (0.5, 0.6, 0.24), SKIN))
            for c in range(4):
                x = foot.x + (c - 1.5) * 0.24
                toe = V((x, foot.y - 0.6 - (0.08 if c in (1, 2) else 0), 0.17))
                parts.append(ellipsoid(f'{name}_toe_{c}', toe, (0.11, 0.24, 0.13), SKIN))
                parts.append(plate(f'{name}_toe_guard_{c}', toe + V((0, 0.05, 0)), V((0, 1, 0)), V((0, 0, 1)), 0.13, 0.2, 200, ARMOR, thick=0.04))
                parts.append(spike(f'{name}_claw_{c}', toe + V((0, -0.2, 0.02)), V((0, -1, -0.35)), 0.45, 0.085, PINK, curve=0.45, curve_dir=V((0, 0, -1))))
            if not front:
                for j in range(4):
                    c = lp[2][0].lerp(lp[1][0], 0.2 + j * 0.18)
                    parts.append(spike(f'{name}_fin_{j}', c + V((0, 0.25, 0)), V((0, 1, 0.35)), 0.55 - j * 0.07, 0.1, PINK, sides=4))
            attach(f'{name}_mesh', parts, g, top)

    return root


def build_head(ARMOR, SKIN, PINK, WHITE, MOUTH, EYE):
    """
    Angular armoured dragon head at the end of the neck, facing -Y.
    Returns (head parts, jaw parts, jaw pivot) in world space before HEAD_SCALE.
    """
    hp = []
    base = NECK[-1][0]
    H = base + V((0, -0.55, -0.25))  # skull centre
    tilt = euler(-14, 0, 0)

    # skull: a tapered armoured wedge, snout wedge in front, cheeks below
    hp.append(wedge('skull', H, (0.48, 0.58, 0.34), ARMOR, taper=(0.6, 0.7), rot=tilt))
    hp.append(wedge('snout', H + V((0, -0.9, 0.0)), (0.27, 0.5, 0.14), ARMOR, taper=(0.42, 0.5), rot=euler(-6, 0, 0)))
    hp.append(wedge('cheek', H + V((0, -0.25, -0.22)), (0.46, 0.5, 0.18), SKIN, taper=(0.7, 0.8)))
    hp.append(ellipsoid('mouth', H + V((0, -0.55, -0.38)), (0.24, 0.55, 0.2), MOUTH, rot=euler(12, 0, 0)))
    # brow ridges over the eyes, angled down to the snout
    for s in (-1, 1):
        hp.append(wedge(f'brow_{s}', H + V((s * 0.33, -0.42, 0.24)), (0.13, 0.36, 0.07), ARMOR, taper=(0.4, 0.6), rot=euler(-12, s * 8, -s * 22)))
        hp.append(ellipsoid(f'eye_{s}', H + V((s * 0.4, -0.4, 0.13)), (0.06, 0.14, 0.055), EYE, rot=euler(0, 0, -s * 22)))
    # upper teeth and pink fangs
    for s in (-1, 1):
        for j in range(5):
            hp.append(spike(f'tooth_u_{s}_{j}', H + V((s * (0.26 - j * 0.03), -0.38 - j * 0.2, -0.17)), V((0, -0.15, -1)), 0.2 - j * 0.015, 0.045, WHITE, sides=4))
        hp.append(spike(f'fang_{s}', H + V((s * 0.12, -1.3, -0.08)), V((0, -0.2, -1)), 0.34, 0.06, PINK, sides=5))
    # long pink nose horn sweeping up and forward
    hp.append(spike('nose_horn', H + V((0, -1.0, 0.14)), V((0, -0.55, 1)), 1.35, 0.17, PINK, curve=-0.35, curve_dir=V((0, -1, 0))))
    # crown of navy blades swept back, plus side blades
    for j, (dx, dz, ln) in enumerate(((0, 0.38, 1.55), (0.26, 0.34, 1.4), (-0.26, 0.34, 1.4), (0.44, 0.14, 1.1), (-0.44, 0.14, 1.1), (0.2, -0.02, 0.85), (-0.2, -0.02, 0.85))):
        hp.append(spike(f'crown_{j}', H + V((dx, 0.12, dz)), V((dx * 1.2, 0.8, 1.0)), ln, 0.15, ARMOR, sides=4, curve=0.25, curve_dir=V((0, 1, 0))))
    for s in (-1, 1):
        hp.append(spike(f'cheek_spike_{s}', H + V((s * 0.42, 0.0, -0.25)), V((s * 0.8, 0.5, -0.4)), 0.6, 0.1, ARMOR, sides=4))

    # lower jaw, modelled open by JAW_OPEN degrees around its hinge
    jp = []
    pivot = H + V((0, -0.02, -0.3))
    rot = euler(JAW_OPEN, 0, 0)
    jp.append(wedge('jaw_bone', pivot + rot @ V((0, -0.66, -0.06)), (0.28, 0.62, 0.11), ARMOR, taper=(0.55, 0.7), rot=rot))
    jp.append(spike('chin_spike', pivot + rot @ V((0, -0.2, -0.12)), rot @ V((0, 0.4, -1)), 0.4, 0.08, ARMOR, sides=4))
    for s in (-1, 1):
        for j in range(5):
            lp = pivot + rot @ V((s * (0.22 - j * 0.025), -0.3 - j * 0.2, 0.06))
            jp.append(spike(f'tooth_l_{s}_{j}', lp, rot @ V((0, -0.1, 1)), 0.17 - j * 0.01, 0.04, WHITE, sides=4))
    return hp, jp, pivot


def export(root):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_apply=True)
    faces = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print('wrote', os.path.abspath(OUT), os.path.getsize(OUT) // 1024, 'KB', faces, 'faces')


if __name__ == '__main__':
    export(build())
