# bake_views.py mesh.glb front.png fit.json out.glb [back.png] [tex_size]
# Textures an untextured generated mesh from its source picture: unwraps it (xatlas), paints every texel
# the front camera sees squarely with the picture (fit.json from fitfast.py: front = +Z, image y down),
# every texel the back camera sees with back.png at the same picture position (the front picture with
# its front-only details painted out; default the front picture itself), and fills the rest (sides,
# hidden folds) with the colour of the nearest painted surface point. The picture's own silhouette ink
# is skipped (the game draws its own outline). With BAKE_TEXELS=file.npz it also saves each surface texel's
# row, column, position and normal, for later paint passes. Needs xatlas (pip install xatlas).
import json
import math
import os
import sys

import numpy as np
import trimesh
import xatlas
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

src, front_png, fit_json, out = sys.argv[1:5]
back_png = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != '-' else front_png
T = int(sys.argv[6]) if len(sys.argv) > 6 else 2048

m = trimesh.load(src, force='mesh')
V = np.asarray(m.vertices, float); F = np.asarray(m.faces)
atlas = xatlas.Atlas()
atlas.add_mesh(V.astype(np.float32), F.astype(np.uint32))
po = xatlas.PackOptions(); po.resolution = T; po.padding = 4; po.bilinear = True
atlas.generate(xatlas.ChartOptions(), po)
vmap, F, UV = atlas[0]
V = V[vmap]
print('unwrapped:', len(V), 'verts', len(F), 'faces', atlas.chart_count, 'charts', flush=True)

# texel -> triangle and barycentrics
tri = np.full((T, T), -1, np.int64); bary = np.zeros((T, T, 3))
U = UV[:, 0] * T; W = (1 - UV[:, 1]) * T
for t, (a, b, c) in enumerate(F):
    u = U[[a, b, c]]; v = W[[a, b, c]]
    u0, u1 = int(max(math.floor(u.min()) - 1, 0)), int(min(math.ceil(u.max()) + 1, T))
    v0, v1 = int(max(math.floor(v.min()) - 1, 0)), int(min(math.ceil(v.max()) + 1, T))
    if u0 >= u1 or v0 >= v1:
        continue
    gv, gu = np.mgrid[v0:v1, u0:u1] + 0.5
    den = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
    if abs(den) < 1e-12:
        continue
    l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / den
    l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / den
    l2 = 1 - l0 - l1
    inside = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
    sub = tri[v0:v1, u0:u1]
    take = inside & (sub < 0)
    sub[take] = t
    bary[v0:v1, u0:u1][take] = np.stack([l0, l1, l2], -1)[take]
ty, tx = np.nonzero(tri >= 0)
tid = tri[ty, tx]; bw = bary[ty, tx]
P = np.einsum('nk,nkd->nd', bw, V[F[tid]])
FN = np.cross(V[F[:, 1]] - V[F[:, 0]], V[F[:, 2]] - V[F[:, 0]])
FN /= np.maximum(np.linalg.norm(FN, axis=1, keepdims=True), 1e-12)
VN = np.zeros_like(V)
np.add.at(VN, F.ravel(), np.repeat(FN, 3, axis=0))
VN /= np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-12)
N = np.einsum('nk,nkd->nd', bw, VN[F[tid]])
N /= np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-12)
print('texels on the surface:', len(P), flush=True)

fit = json.load(open(fit_json))
c, s = math.cos(fit['yaw']), math.sin(fit['yaw'])


def cam(p):
    return (p[:, 0] * c + p[:, 2] * s) * fit['scale'] + fit['ox'], -p[:, 1] * fit['scale'] + fit['oy'], -p[:, 0] * s + p[:, 2] * c


front = np.array(Image.open(front_png).convert('RGBA')).astype(float)
back = np.array(Image.open(back_png).convert('RGBA')).astype(float)
H, Wd = front.shape[:2]
# texels this close to the picture's silhouette would pick up its outline ink
ERODE = int(round(0.006 * H))
ok_front = ndimage.binary_erosion(front[..., 3] > 128, iterations=ERODE)
ok_back = ndimage.binary_erosion(back[..., 3] > 128, iterations=ERODE)

# depth buffers (front-most surface seen from the front and from the back) by dense surface samples
S, _ = trimesh.sample.sample_surface(trimesh.Trimesh(V, F, process=False), 4_000_000, seed=3)
sx, sy, sz = cam(S)
pix = (np.clip(sy, 0, H - 1).astype(int) * Wd + np.clip(sx, 0, Wd - 1).astype(int))
zf = np.full(H * Wd, -np.inf); np.maximum.at(zf, pix, sz)
zb = np.full(H * Wd, -np.inf); np.maximum.at(zb, pix, -sz)
zf = ndimage.maximum_filter(zf.reshape(H, Wd), 3); zb = ndimage.maximum_filter(zb.reshape(H, Wd), 3)
EPS = 0.006 * (V[:, 1].max() - V[:, 1].min())

px, py, pz = cam(P)
ix = np.clip(np.round(px), 0, Wd - 1).astype(int); iy = np.clip(np.round(py), 0, H - 1).astype(int)
nz = (-N[:, 0] * s + N[:, 2] * c)  # towards the front camera


def sample(img, x, y):
    x = np.clip(x, 0, img.shape[1] - 1.001); y = np.clip(y, 0, img.shape[0] - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); ax = x - x0; ay = y - y0
    o = 0
    for dy, wy in ((0, 1 - ay), (1, ay)):
        for dx, wx in ((0, 1 - ax), (1, ax)):
            o = o + img[y0 + dy, x0 + dx] * (wy * wx)[:, None]
    return o


MIN_FACING = float(os.environ.get('BAKE_FACING', 0.2))
vis_f = (pz >= zf[iy, ix] - EPS) & ok_front[iy, ix] & (nz > MIN_FACING)
vis_b = (-pz >= zb[iy, ix] - EPS) & ok_back[iy, ix] & (-nz > MIN_FACING)
col = np.zeros((len(P), 3)); done = np.zeros(len(P), bool)
col[vis_f] = sample(front, px[vis_f], py[vis_f])[:, :3]; done |= vis_f
vb = vis_b & ~vis_f
col[vb] = sample(back, px[vb], py[vb])[:, :3]; done |= vb
print(f'painted from the front {vis_f.mean():.2f}, from the back {vb.mean():.2f}, filled {(~done).mean():.2f}', flush=True)

# the rest: average of the nearest painted points on the same side (normals roughly agree)
tree = cKDTree(P[done])
dist, nn = tree.query(P[~done], k=12)
pc = col[done][nn]; pn = N[done][nn]
agree = np.clip((pn * N[~done][:, None, :]).sum(-1), 0, 1) + 0.05
w = agree / (dist + 1e-4)
col[~done] = (pc * w[..., None]).sum(1) / w.sum(1)[:, None]

if os.environ.get('BAKE_TEXELS'):
    np.savez_compressed(os.environ['BAKE_TEXELS'], ty=ty, tx=tx, P=P.astype(np.float32), N=N.astype(np.float32))
tex = np.zeros((T, T, 3)); tex[ty, tx] = col
# gutter: extend charts outwards so filtering never reads the empty background
filled = tri >= 0
idx = ndimage.distance_transform_edt(~filled, return_distances=False, return_indices=True)
tex = tex[idx[0], idx[1]]
img = Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8))
mat = trimesh.visual.material.PBRMaterial(baseColorTexture=img, metallicFactor=0.0, roughnessFactor=1.0)
mesh = trimesh.Trimesh(V, F, visual=trimesh.visual.TextureVisuals(uv=UV, material=mat), process=False)
mesh.export(out)
img.save(out.replace('.glb', '-tex.png'))
print('wrote', out)
