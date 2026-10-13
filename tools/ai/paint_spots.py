# paint_spots.py model.glb tex_in tex_out spots.json ["<texel test on r, g, b>"]
# Paints clean oval spots on the model's surface (e.g. the markings on armour plates that the generator lost).
# spots.json: [{"p": [x, y, z], "d": [dx, dy, dz], "a": half length, "b": half width, "fill": [r, g, b]}, ...]
# in model units: p is a point on the surface, d the direction of the oval's long axis. A texel is painted when
# its surface point lies inside the oval round p (measured along d and across it, in the surface's plane, and
# no further than b off that plane, so thin parts are not painted through), and it passes the texel test
# (default: any texel), with a soft rim.
import json
import sys

import numpy as np
import trimesh
from PIL import Image

s = trimesh.load(sys.argv[1], force='mesh', process=False)
tex = np.array(Image.open(sys.argv[2]).convert('RGB')).astype(float)
spots = json.load(open(sys.argv[4]))
test = eval('lambda r, g, b: ' + (sys.argv[5] if len(sys.argv) > 5 else 'r == r'))
TH, TW = tex.shape[:2]
V = np.asarray(s.vertices, float); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv, float)
FN = s.face_normals
cen = V[F].mean(1)
reach = max(sp['a'] for sp in spots) * 1.5
out = tex.copy()
U = UV[:, 0] * TW; W = (1 - UV[:, 1]) * TH
painted = 0
for sp in spots:
    p = np.array(sp['p'], float); d = np.array(sp['d'], float)
    # the surface's normal at the spot: mean of the nearby faces' normals
    near = np.linalg.norm(cen - p, axis=1) < sp['b']
    nrm = FN[near].mean(0) if near.any() else np.array([0.0, 0, 1])
    nrm /= max(np.linalg.norm(nrm), 1e-9)
    d = d - nrm * (d @ nrm); d /= max(np.linalg.norm(d), 1e-9)
    e = np.cross(nrm, d)
    cand = np.where((np.linalg.norm(cen - p, axis=1) < sp['a'] + reach * 0.2) & ((FN @ nrm) > 0.3))[0]
    fill = np.array(sp['fill'], float)
    for t in cand:
        a, b, c = F[t]
        u = U[[a, b, c]]; v = W[[a, b, c]]
        u0, u1 = int(max(u.min() - 1, 0)), int(min(u.max() + 2, TW))
        v0, v1 = int(max(v.min() - 1, 0)), int(min(v.max() + 2, TH))
        if u0 >= u1 or v0 >= v1:
            continue
        gv, gu = np.mgrid[v0:v1, u0:u1] + 0.5
        den = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
        if abs(den) < 1e-12:
            continue
        l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / den
        l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / den
        l2 = 1 - l0 - l1
        m = (l0 >= -0.05) & (l1 >= -0.05) & (l2 >= -0.05)
        P = l0[..., None] * V[a] + l1[..., None] * V[b] + l2[..., None] * V[c]
        q = P - p
        along = q @ d; across = q @ e; off = np.abs(q @ nrm)
        rr = np.sqrt((along / sp['a']) ** 2 + (across / sp['b']) ** 2)
        w = np.clip((1 - rr) / 0.15, 0, 1) * m * (off < sp['b'])  # soft rim, 15% of the radius
        cur = out[v0:v1, u0:u1]
        w = w * test(tex[v0:v1, u0:u1, 0], tex[v0:v1, u0:u1, 1], tex[v0:v1, u0:u1, 2])
        hit = w > 0
        cur[hit] = cur[hit] * (1 - w[hit, None]) + fill * w[hit, None]
        painted += int(hit.sum())
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(sys.argv[3])
print('spots', len(spots), 'texels painted', painted)
