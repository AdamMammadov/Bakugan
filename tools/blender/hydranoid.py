"""
Builds the G1 Darkus Hydranoid ball (and its opened pose) and exports
public/models/hydranoid/ball.glb.

Run:  python3 tools/blender/hydranoid.py      (needs `pip install bpy`)

Every shell piece is cut from one high-resolution sphere by region tests in
"wheel coordinates":
  a = angle from the wheel axis (0° at the hub, 180° on the far side)
  b = azimuth around that axis (0° front, 90° top, 180° back, 270° bottom)
Pieces that move when the ball opens carry glTF extras with their open pose
(`openPos`, `openRot` in three.js space) so the web viewer can animate them;
parts that only exist in the open form carry `openOnly: true`.
"""

import math
import os
import sys

import bpy  # noqa: I001 — must be imported before bmesh/mathutils
import bmesh
from mathutils import Matrix, Quaternion, Vector

V = Vector

# open ("stand up") pose, three.js space: y up, z front
OPEN_LIFT = 0.32
SKULL_POS = (0.02, 0.36, 0.78)
SKULL_PITCH, SKULL_YAW = -0.55, -0.6

OUT = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'models', 'hydranoid', 'ball.glb')

# Blender is Z-up; glTF/three.js is Y-up with Blender's -Y becoming +Z (front).
FRONT = Vector((0, -1, 0))
UP = Vector((0, 0, 1))
WHEEL = Vector((-1, 0, 0))  # hub on the creature's right side
SIDE2 = WHEEL.cross(FRONT)  # completes the frame (= up when WHEEL is +X)

R = 1.0  # outer radius
SHELL = 0.055  # shell thickness
GAP = math.radians(0.9)  # half-width of the grooves between panels

deg = math.radians


# ---------------------------------------------------------------- helpers


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color, rough=0.6, metal=0.0, emit=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit:
        bsdf.inputs['Emission Color'].default_value = (*emit, 1)
        bsdf.inputs['Emission Strength'].default_value = strength
    return m


def srgb(h):
    h = h.lstrip('#')
    c = [int(h[i : i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


BLACK = None
PURPLE = None
CORE = None
EYE = None
BLUE = None
GROOVE = None


def wheel_coords(p: Vector):
    """(a, b) in radians for a point on the sphere."""
    n = p.normalized()
    a = math.acos(max(-1.0, min(1.0, n.dot(WHEEL))))
    b = math.atan2(n.dot(SIDE2), n.dot(FRONT)) % (2 * math.pi)
    return a, b


def from_wheel(a, b, r=R):
    """Point on a sphere of radius r from wheel coordinates (radians)."""
    perp = FRONT * math.cos(b) + SIDE2 * math.sin(b)
    return (WHEEL * math.cos(a) + perp * math.sin(a)) * r


def ang_in(b, lo, hi):
    """Is azimuth b (radians) inside [lo, hi] going counter-clockwise (degrees)."""
    b = math.degrees(b) % 360
    lo %= 360
    hi %= 360
    return lo <= b <= hi if lo <= hi else (b >= lo or b <= hi)


_sphere_cache = {}


def base_sphere():
    if 'bm' not in _sphere_cache:
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=256, v_segments=128, radius=R)
        bm.faces.ensure_lookup_table()
        _sphere_cache['bm'] = bm
    return _sphere_cache['bm']


def shell_piece(name, keep, mat, thickness=SHELL, bevel=0.012, radius=1.0):
    """New object from the sphere faces whose centre satisfies keep(a, b)."""
    src = base_sphere()
    bm = bmesh.new()
    vmap = {}
    for f in src.faces:
        c = f.calc_center_median()
        a, b = wheel_coords(c)
        if not keep(a, b):
            continue
        verts = []
        for v in f.verts:
            if v.index not in vmap:
                vmap[v.index] = bm.verts.new(v.co * radius)
            verts.append(vmap[v.index])
        bm.faces.new(verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = -1
    if bevel:
        bev = ob.modifiers.new('bevel', 'BEVEL')
        bev.width = bevel
        bev.segments = 2
        bev.limit_method = 'ANGLE'
        bev.angle_limit = deg(50)
    apply_all(ob)
    smooth(ob)
    return ob


def patch(name, a0, a1, b_lo, b_hi, mat, thickness=SHELL, bevel=0.01, radius=R, na=None, nb=None, solid=True):
    """
    A clean-edged shell panel over a ∈ [a0, a1] (degrees from the wheel axis) and, for each a,
    b ∈ [b_lo(a), b_hi(a)] (degrees around it). b_lo / b_hi may be numbers or callables.
    """
    lo = b_lo if callable(b_lo) else (lambda a, v=b_lo: v)
    hi = b_hi if callable(b_hi) else (lambda a, v=b_hi: v)
    na = na or max(4, int(abs(a1 - a0) / 1.5))
    span = max(abs(hi(a0) - lo(a0)), abs(hi(a1) - lo(a1)), abs(hi((a0 + a1) / 2) - lo((a0 + a1) / 2)))
    nb = nb or max(4, int(span / 1.5))
    bm = bmesh.new()
    rows = []
    for i in range(na + 1):
        a = a0 + (a1 - a0) * i / na
        row = []
        for j in range(nb + 1):
            b = lo(a) + (hi(a) - lo(a)) * j / nb
            row.append(bm.verts.new(from_wheel(deg(a), deg(b), radius)))
        rows.append(row)
    for i in range(na):
        for j in range(nb):
            bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    # make normals point outward
    me.update()
    if me.polygons and me.polygons[0].normal.dot(me.polygons[0].center) < 0:
        me.flip_normals()
    if solid:
        sol = ob.modifiers.new('solid', 'SOLIDIFY')
        sol.thickness = thickness
        sol.offset = -1
        if bevel:
            bev = ob.modifiers.new('bevel', 'BEVEL')
            bev.width = bevel
            bev.segments = 2
            bev.limit_method = 'ANGLE'
            bev.angle_limit = deg(50)
        apply_all(ob)
    smooth(ob)
    return ob


def segmented_ring(name, a0, a1, start, end, count, gap, mat, **kw):
    """A band split into `count` blocks between azimuths start..end (degrees)."""
    obs = []
    step = (end - start) / count
    for k in range(count):
        b0 = start + k * step + gap
        b1 = start + (k + 1) * step - gap
        obs.append(patch(f'{name}_{k}', a0, a1, b0, b1, mat, **kw))
    return join(name, obs)


def join(name, obs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    obs[0].name = name
    return obs[0]


def apply_all(ob):
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)


def smooth(ob, angle=40):
    for p in ob.data.polygons:
        p.use_smooth = True
    try:
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shade_auto_smooth(angle=deg(angle))
    except Exception:
        pass


def crystal(name, length, width, mat, sides=4):
    """A faceted purple crystal spike pointing along +Z from the origin."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=width, radius2=0, depth=length)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, length / 2))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width = width * 0.15
    bev.segments = 1
    apply_all(ob)
    return ob


def place_on_sphere(ob, a, b, r=R * 0.97, tilt=(0, 0), roll=0.0):
    """Stand `ob` (+Z up) on the sphere at wheel coords (a, b), optionally tilted."""
    p = from_wheel(a, b, r)
    n = p.normalized()
    q = Vector((0, 0, 1)).rotation_difference(n)
    # tilt along the tangent directions (towards +a, towards +b)
    ta = (from_wheel(a + 0.01, b) - from_wheel(a, b)).normalized()
    tb = (from_wheel(a, b + 0.01) - from_wheel(a, b)).normalized()
    q = Quaternion(tb, tilt[0]) @ Quaternion(ta, -tilt[1]) @ q
    q = Quaternion(n, roll) @ q
    ob.location = p
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = q


def yaw_then_pitch(yaw, pitch):
    """three.js 'XYZ' Euler for: pitch about X first, then yaw about the world Y axis."""
    from mathutils import Matrix as M

    m = M.Rotation(yaw, 3, 'Y') @ M.Rotation(pitch, 3, 'X')
    e = m.to_euler('ZYX')  # matrix Rx·Ry·Rz == three.js 'XYZ'
    return (e.x, e.y, e.z)


def parent(child, par):
    child.parent = par


def empty(name, open_pos=None, open_rot=None, open_only=False, closed_only=False):
    ob = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(ob)
    if open_pos is not None:
        ob['openPos'] = list(open_pos)
    if open_rot is not None:
        ob['openRot'] = list(open_rot)
    if open_only:
        ob['openOnly'] = True
    if closed_only:
        ob['closedOnly'] = True
    return ob


# ---------------------------------------------------------------- regions

WHEEL_EDGE = deg(65)
RING_EDGE = deg(68.5)
CREST_EDGE = deg(76)


def in_triangle_window(a, b):
    """Triangular cut-outs of the back lattice panel."""
    da = math.degrees(a)
    db = math.degrees(b) % 360
    if not (deg(76) <= a <= deg(165) and 120 <= db <= 250):
        return False
    row_h = 22.0
    col_w = 20.0
    r = (da - 76) / row_h
    c = (db - 120) / col_w
    ri, rf = int(r), r - int(r)
    ci, cf = int(c), c - int(c)
    # alternate up/down triangles; keep a frame around each
    m = 0.2
    if rf < m or rf > 1 - m:
        return False
    t = (rf - m) / (1 - 2 * m)
    half = 0.5 * (t if (ri + ci) % 2 == 0 else 1 - t)
    return abs(cf - 0.5) < half - 0.12


def wheel_window(a, b):
    """Purple windows between the wheel's spokes."""
    if not (deg(15) <= a <= deg(41)):
        return False
    spoke = (math.degrees(b) % 36.0) - 18.0
    return abs(spoke) > 5.0


# ---------------------------------------------------------------- build


def build():
    global BLACK, PURPLE, CORE, EYE, BLUE, GROOVE
    reset()
    BLACK = material('black', srgb('#141218'), rough=0.78)
    PURPLE = material('purple', srgb('#9558c8'), rough=0.45)
    CORE = material('core', srgb('#7a46b0'), rough=0.42)
    BLUE = material('blue', srgb('#4b4fb8'), rough=0.18)
    GROOVE = material('groove', srgb('#050407'), rough=0.9)
    EYE = material('eye', (1, 0.05, 0.05), rough=0.3, emit=(1, 0.05, 0.03), strength=8)

    # open pose: the ball stands up on its new legs
    root = empty('Hydranoid', open_pos=(0, OPEN_LIFT, 0))

    core = sphere_mesh('core', 0.9, BLUE)
    parent(core, root)

    G = 0.7  # groove half-width in degrees

    # --- side wheel (stays on the body as the hip) -------------------------
    wheel = empty('wheel')
    parent(wheel, root)
    parent(patch('wheel_hub', 0, 11, 0, 360, BLACK, thickness=0.1, radius=0.955, nb=96), wheel)
    parent(segmented_ring('wheel_hub_rim', 11.8, 15, 0, 360, 10, 0.6, BLACK), wheel)
    spokes = []
    for k in range(8):
        c = k * 45 + 22.5
        # each spoke is a pair of constant-width bars split by a thin groove,
        # so the purple windows between them widen towards the rim
        for side in (-1, 1):
            inner = lambda a: 0.45 / math.sin(deg(a))
            outer = lambda a: 6.4 / math.sin(deg(a))
            if side < 0:
                lo = lambda a, c=c, o=outer: c - o(a)
                hi = lambda a, c=c, i=inner: c - i(a)
            else:
                lo = lambda a, c=c, i=inner: c + i(a)
                hi = lambda a, c=c, o=outer: c + o(a)
            spokes.append(patch(f'spoke_{k}_{side}', 15.8, 47.5, lo, hi, BLACK, na=24, nb=4))
    parent(join('wheel_spokes', spokes), wheel)
    parent(segmented_ring('wheel_ring', 48.3, 56, 0, 360, 8, 0.5, BLACK), wheel)
    parent(patch('wheel_windows', 14, 48.5, 0, 360, PURPLE, radius=0.975, thickness=0.02, bevel=0, nb=120), wheel)

    # --- segmented band next to the wheel -----------------------------------
    parent(segmented_ring('band', 56.8, 65, 22.5, 382.5, 10, 0.45, BLACK), wheel)

    # --- crest band with the crystal teeth (becomes the neck crest) ---------
    crest = empty('crest', open_pos=(0.0, 0.32, 0.05), open_rot=(-0.12, 0, 0))
    parent(crest, root)
    parent(segmented_ring('crest_shell', 65.8, 68, -2, 215, 7, 0.4, BLACK), crest)
    for i, bdeg in enumerate(range(8, 214, 17)):
        t = fang(f'tooth_{i}', a=72.0, b=float(bdeg), span=15.0, depth=7.0, height=0.21)
        parent(t, crest)
    parent(patch('crest_gap', 68, 76, -2, 215, GROOVE, radius=0.95, thickness=0.02, bevel=0), crest)
    # the rest of that ring (below the face) is plain shell
    parent(patch('chin_band', 65.8, 76, 215 + 0.6, 358 - 0.6, BLACK), wheel)

    # --- top / shoulder panel between head and crest ------------------------
    top = empty('top', open_pos=(0, 0.05, -0.12), open_rot=(0.1, 0, 0))
    parent(top, root)
    parent(patch('top_shell', 76, 180, 19 + G, 119 - G, BLACK, na=80), top)
    # the lower front shell drops forward into a belly / foot plate
    belly = empty('belly', closed_only=True)
    parent(belly, root)
    parent(patch('bottom_shell', 62, 180, 216 + G, 300 - G, BLACK, na=80), belly)

    # --- head panel: front / lower front, eyes and folded horns -------------
    head = empty('head', open_pos=SKULL_POS, open_rot=yaw_then_pitch(SKULL_YAW, SKULL_PITCH))
    parent(head, root)
    parent(patch('head_shell', 76, 180, -60 + G, 19 - G, BLACK, na=80), head)
    # the long folded horn sweeping from the crown down to the outer eye
    parent(horn_patch('horn_0', 82.0, -36, 18, drift=8, peak=4.8, bow=7), head)
    parent(horn_patch('horn_1', 84.0, 40, 88, drift=-2, peak=3.0, bow=3), top)
    for i, (ea, eb, roll) in enumerate(((80, -28, 80), (110, -30, 45))):
        e = eye_mesh(f'eye_{i}')
        place_on_sphere(e, deg(ea), deg(eb % 360), r=0.998, roll=deg(roll))
        parent(e, head)
    # curved jaw grooves sweeping down to the eyes
    for i, (s0, s1, off) in enumerate(((80, 104, 0), (86, 112, 6), (92, 120, 12))):
        parent(groove(f'groove_{i}', s0, s1, 18 - off, -30 + off * 0.5), head)

    # --- back lattice panel (becomes the back plate / tail) -----------------
    back = empty('back', closed_only=True)
    parent(back, root)
    parent(patch('back_shell', 76, 180, 120 + G, 215 - G, BLACK, na=80), back)
    parent(lattice_windows('back_windows'), back)

    # --- parts that only exist in the open form -----------------------------
    # (Blender coords here: x = side (wheel at -x), -y = front, z = up; ground = -1 - OPEN_LIFT)
    ground = -1.0 - OPEN_LIFT
    extra = empty('open_parts', open_only=True)
    parent(extra, root)
    # black chest closing the front-lower body under the lifted skull
    parent(patch('chest', 70, 179, 228, 318, BLACK, radius=0.965, na=50), extra)
    # glossy blue core slab showing between the crest and the skull
    parent(box('core_block_0', V((-0.18, -0.5, 0.42)), (0.3, 0.26, 0.26), BLUE), extra)
    parent(box('core_block_1', V((-0.18, -0.58, -0.08)), (0.3, 0.24, 0.22), BLUE), extra)
    # two thin legs with purple three-toed feet
    for s, (lx, ly) in ((-1, (-0.62, -0.42)), (1, (0.55, -0.45))):
        top_z = -0.55
        parent(cone(f'leg_{s}', V((lx, ly, ground + 0.12)), V((0, 0, 1)), top_z - ground, 0.075, BLACK, sides=10), extra)
        parent(box(f'foot_{s}', V((lx, ly - 0.06, ground + 0.06)), (0.08, 0.12, 0.06), PURPLE), extra)
        for c in (-1, 0, 1):
            parent(cone(f'claw_{s}_{c}', V((lx + c * 0.055, ly - 0.17, ground + 0.04)), V((c * 0.25, -1, -0.15)), 0.1, 0.028, PURPLE), extra)
    # purple teeth lining the skull's jaw edge
    jaw = empty('jaw_teeth', open_only=True)
    parent(jaw, head)
    for i, a in enumerate(range(80, 178, 8)):
        p = from_wheel(deg(a), deg(-57.5), R * 0.985)
        d = from_wheel(deg(a), deg(-80), R) - from_wheel(deg(a), deg(-57.5), R)
        parent(cone(f'jaw_tooth_{i}', p, d, 0.26, 0.07, PURPLE, sides=4), jaw)
    # three purple spikes along the top of the skull
    spikes = empty('skull_spikes', open_only=True)
    parent(spikes, head)
    for i, bdeg in enumerate((-8, 6, 18)):
        p = from_wheel(deg(105 + i * 18), deg(bdeg), R * 0.97)
        parent(cone(f'skull_spike_{i}', p, p.normalized(), 0.32, 0.08, PURPLE, sides=4), spikes)
    # black body shell: the opened body stays black except a front window showing the blue core
    parent(patch('body_shell_a', 62, 179, 62, 322, BLACK, radius=0.95, na=50), extra)
    parent(patch('body_shell_b', 118, 179, -40, 62, BLACK, radius=0.95, na=30), extra)
    # foot plate: long segmented tongue lying on the ground in front, serrated purple tip
    parent(tongue('foot_plate', start=V((-0.1, -0.6, -0.92)), direction=V((-0.12, -1, -0.32)), length=1.35,
                  w0=0.5, w1=0.36, curl=0.18, segments=7, mat=BLACK, tip=PURPLE, teeth=5), extra)
    # tail: a long scoop lying behind, curling up, ending in a flat purple blade
    parent(tongue('tail_scoop', start=V((-0.15, 0.8, -0.85)), direction=V((-0.08, 1, -0.4)), length=1.25,
                  w0=0.4, w1=0.24, curl=0.3, segments=6, mat=BLACK, tip=PURPLE, teeth=4, scoop=True, blade=True), extra)

    return root


def horn_slot(a, b):
    """Two long curved purple slashes on the head (the folded horns)."""
    db = math.degrees(b) % 360
    if db > 180:
        db -= 360
    da = math.degrees(a)
    for centre in (100.0, 140.0):
        # crescent: a drifts as b sweeps from -60 to +15
        if -62 <= db <= 15:
            k = (db + 62) / 77
            ca = centre + 10 * math.sin(k * math.pi) - 6 * k
            w = 2.6 * math.sin(k * math.pi) + 0.4
            if abs(da - ca) < w:
                return True
    return False


def horn_patch(name, centre, b0, b1, drift=-6.0, peak=3.0, bow=6.0):
    """A long curved purple slash (folded horn) on the head, as a crisp patch."""
    def width(b):
        k = (b - b0) / (b1 - b0)
        return 0.3 + peak * math.sin(k * math.pi) ** 0.7

    def mid(b):
        k = (b - b0) / (b1 - b0)
        return centre + bow * math.sin(k * math.pi) + drift * k

    # parametrise along b instead of a: swap roles by sampling a strip
    bm_obs = []
    n = 40
    verts = []
    bm = bmesh.new()
    rows = []
    for i in range(n + 1):
        b = b0 + (b1 - b0) * i / n
        m, w = mid(b), width(b)
        rows.append([bm.verts.new(from_wheel(deg(m + t * w), deg(b), R * 1.002)) for t in (-1, -0.5, 0, 0.5, 1)])
    for i in range(n):
        for j in range(4):
            bm.faces.new((rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(PURPLE)
    me.update()
    if me.polygons[0].normal.dot(me.polygons[0].center) < 0:
        me.flip_normals()
    sol = ob.modifiers.new('solid', 'SOLIDIFY')
    sol.thickness = 0.03
    sol.offset = -1
    apply_all(ob)
    smooth(ob)
    return ob


def lattice_windows(name):
    """Rows of alternating triangles (purple) laid over the back panel."""
    tris = []
    rows = [(76, 96), (100, 120), (124, 144), (148, 166)]
    for r, (a0, a1) in enumerate(rows):
        cols = 6 - r
        span = (205 - 128) / cols
        for c in range(cols):
            cb = 128 + span * (c + 0.5)
            half = span * 0.3
            up = (r + c) % 2 == 0
            if up:
                lo = lambda a, a0=a0, a1=a1, cb=cb, half=half: cb - half * (a - a0) / (a1 - a0) - 0.01
                hi = lambda a, a0=a0, a1=a1, cb=cb, half=half: cb + half * (a - a0) / (a1 - a0) + 0.01
            else:
                lo = lambda a, a0=a0, a1=a1, cb=cb, half=half: cb - half * (a1 - a) / (a1 - a0) - 0.01
                hi = lambda a, a0=a0, a1=a1, cb=cb, half=half: cb + half * (a1 - a) / (a1 - a0) + 0.01
            tris.append(patch(f'{name}_{r}_{c}', a0, a1, lo, hi, PURPLE, radius=R * 1.002, thickness=0.012, bevel=0, na=12, nb=8))
    return join(name, tris)


def groove(name, a0, a1, b0, b1):
    """A thin dark recessed line running from (a0, b0) to (a1, b1) with a gentle curve."""
    bm = bmesh.new()
    n = 40
    rows = []
    for i in range(n + 1):
        k = i / n
        a = a0 + (a1 - a0) * k
        b = b0 + (b1 - b0) * (k ** 1.4)
        w = 0.45
        rows.append([bm.verts.new(from_wheel(deg(a + t * w), deg(b), R * 1.0015)) for t in (-1, 1)])
    for i in range(n):
        bm.faces.new((rows[i][0], rows[i][1], rows[i + 1][1], rows[i + 1][0]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(GROOVE)
    me.update()
    if me.polygons[0].normal.dot(me.polygons[0].center) < 0:
        me.flip_normals()
    return ob


def sphere_mesh(name, radius, mat, seg=64):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=radius)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    smooth(ob, 80)
    return ob


def fang(name, a, b, span, depth, height):
    """
    A broad faceted crystal tooth sitting in the crest gap: its base spans `span` degrees
    along the ring and `depth` degrees across it, and its ridge rises `height` above the
    shell, leaning towards the head (+a) like the reference's shark teeth.
    """
    bm = bmesh.new()
    rb = R * 0.97
    corners = [
        from_wheel(deg(a - depth / 2), deg(b - span / 2), rb),
        from_wheel(deg(a - depth / 2), deg(b + span / 2), rb),
        from_wheel(deg(a + depth / 2), deg(b + span / 2), rb),
        from_wheel(deg(a + depth / 2), deg(b - span / 2), rb),
    ]
    base = [bm.verts.new(c) for c in corners]
    n = from_wheel(deg(a), deg(b)).normalized()
    # ridge: two points, leaning towards the head side, slightly narrower than the base
    ridge = [
        bm.verts.new(from_wheel(deg(a + depth * 0.45), deg(b - span * 0.18), rb) + n * height),
        bm.verts.new(from_wheel(deg(a + depth * 0.45), deg(b + span * 0.18), rb) + n * height),
    ]
    mid = [
        bm.verts.new(from_wheel(deg(a - depth * 0.1), deg(b - span * 0.42), rb) + n * height * 0.55),
        bm.verts.new(from_wheel(deg(a - depth * 0.1), deg(b + span * 0.42), rb) + n * height * 0.55),
    ]
    b0, b1, b2, b3 = base
    r0, r1 = ridge
    m0, m1 = mid
    for f in ((b0, b1, m1, m0), (m0, m1, r1, r0), (b1, b2, r1, m1), (b3, b0, m0, r0), (b2, b3, r0, r1), (b3, b2, b1, b0)):
        bm.faces.new(f)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(PURPLE)
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width = 0.012
    bev.segments = 2
    apply_all(ob)
    return ob


def box(name, centre, size, mat):
    """A rounded block (half-extents `size`)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    bev = ob.modifiers.new('bevel', 'BEVEL')
    bev.width = min(size) * 0.45
    bev.segments = 4
    apply_all(ob)
    smooth(ob, 80)
    return ob


def cone(name, base, direction, length, radius, mat, sides=6):
    """A simple spike from `base` along `direction`."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=0, depth=length)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, length / 2))
    q = Vector((0, 0, 1)).rotation_difference(Vector(direction).normalized())
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=q.to_matrix())
    bmesh.ops.translate(bm, verts=bm.verts, vec=base)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(mat)
    return ob


def tongue(name, start, direction, length, w0, w1, curl, segments, mat, tip, teeth=0, scoop=False, blade=False):
    """
    A long tapered plate (foot plate / tail) lying along `direction` from `start`, made of
    `segments` bevelled blocks with grooves, curling up by `curl` at the end. A scoop gets
    raised rims. The tip gets purple serrations (and optionally a flat blade).
    """
    d = Vector(direction).normalized()
    side = Vector((0, 0, 1)).cross(d).normalized()
    up = Vector((0, 0, 1))
    obs = []
    seg_len = length / segments
    for k in range(segments):
        f0, f1 = k / segments, (k + 1) / segments
        def at(f):
            return start + d * (length * f) + up * (curl * f * f * length)
        c = (at(f0) + at(f1)) / 2
        w = w0 + (w1 - w0) * (f0 + f1) / 2
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=2)
        bmesh.ops.scale(bm, vec=(w, seg_len * 0.495, 0.06), verts=bm.verts)
        tangent = (at(f1) - at(f0)).normalized()
        m = Matrix((side, tangent, side.cross(tangent))).transposed()
        bmesh.ops.transform(bm, matrix=m.to_4x4(), verts=bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=c)
        me = bpy.data.meshes.new(f'{name}_{k}')
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f'{name}_{k}', me)
        bpy.context.collection.objects.link(ob)
        me.materials.append(mat)
        bev = ob.modifiers.new('bevel', 'BEVEL')
        bev.width = 0.025
        bev.segments = 2
        apply_all(ob)
        obs.append(ob)
        if scoop:
            for s_ in (-1, 1):
                rim = cone(f'{name}_rim_{k}_{s_}', c + side * s_ * w * 0.95, up, 0.12, 0.06, mat, sides=6)
                obs.append(rim)
        # small purple side spikes on later segments
        if k >= segments // 2:
            for s_ in (-1, 1):
                p = c + side * s_ * w
                obs.append(cone(f'{name}_side_{k}_{s_}', p, side * s_ + d * 0.6 + up * 0.3, 0.13, 0.045, tip, sides=4))
    end = start + d * length + up * (curl * length)
    wt = w1
    for i in range(teeth):
        x = -wt + 2 * wt * (i + 0.5) / teeth
        obs.append(cone(f'{name}_tooth_{i}', end + side * x - d * 0.02, d + up * 0.1, 0.16, 0.05, tip, sides=4))
    if blade:
        obs.append(cone(f'{name}_blade', end + up * 0.05, d + up * 0.45, 0.7, 0.16, tip, sides=4))
    return join(name, obs)


def eye_mesh(name):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=12, radius=1)
    for v in bm.verts:
        # pinch the ends into points (leaf / almond shape)
        k = abs(v.co.x)
        v.co.y *= (1 - k) ** 0.6
    bmesh.ops.scale(bm, vec=(0.17, 0.075, 0.02), verts=bm.verts)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(EYE)
    smooth(ob)
    return ob


def export():
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.abspath(OUT),
        export_format='GLB',
        export_extras=True,
        export_apply=True,
        export_draco_mesh_compression_enable=False,
    )
    print('wrote', os.path.abspath(OUT), os.path.getsize(OUT) // 1024, 'KB')


if __name__ == '__main__':
    build()
    export()
