# detach.py in.glb out.glb '<json>': lifts a part the generator flattened onto another surface
# (Leonidas's tail mace lying in its wing). Picks the light triangles in a box as the part (plus a
# margin of whatever lies around them in the same plane), moves a copy of it by a rotation about its
# centre and a translation (as its own mesh when the config has a `name`), and leaves a patch in the
# old place, coloured like a sample spot, so no hole shows.
# json: box [[x0,y0,z0],[x1,y1,z1]], light (min brightness of the part), margin, thick (distance from
# the part's plane), face (direction the part ends up facing), to (its new centre), sample (box of
# dark triangles to colour the patch like), dark (their max brightness) or patch_uv, name.
# Leonidas: {"box":[[0.44,-0.42,-0.6],[1.0,0.02,-0.12]],"light":120,"margin":0.03,"thick":0.07,
#   "face":[0,0,1],"to":[0.68,-0.19,-0.11],"sample":[[0.55,-0.05,-0.6],[0.95,0.15,0.0]],"dark":40,"name":"mace"}
import sys, json
import numpy as np, trimesh
from PIL import Image
from scipy import ndimage
src, dst, cfg = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
s = trimesh.load(src, force='mesh', process=False)
V = np.asarray(s.vertices, float); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv, float)
tex = np.array(s.visual.material.baseColorTexture.convert('RGB')).astype(float); H, W = tex.shape[:2]
def colours(fuv):
    return tex[((1 - fuv[:, 1]) * (H - 1)).astype(int).clip(0, H - 1), (fuv[:, 0] * (W - 1)).astype(int).clip(0, W - 1)]
c = V[F].mean(1); col = colours(UV[F].mean(1)); lum = col.mean(1)
lo, hi = np.array(cfg['box'][0]), np.array(cfg['box'][1])
inbox = np.all((c > lo) & (c < hi), 1)
core = inbox & (lum > cfg.get('light', 120))
ctr = c[core].mean(0)
_, _, vt = np.linalg.svd(c[core] - ctr)
n, a1, a2 = vt[2], vt[0], vt[1]
# the part: anything in the box near the plane whose projection lies within `margin` of the light core
R = 400; ext = np.abs((c[inbox] - ctr) @ np.stack([a1, a2], 1)).max() * 1.1
grid = lambda P: np.clip(((P @ np.stack([a1, a2], 1)) / ext * 0.5 + 0.5) * (R - 1), 0, R - 1).astype(int)
g = grid(c[core] - ctr)
mask = np.zeros((R, R), bool); mask[g[:, 1], g[:, 0]] = True
mask = ndimage.binary_closing(mask, iterations=3)
mask = ndimage.binary_dilation(mask, iterations=int(cfg.get('margin', 0.02) / (2 * ext) * R) + 1)
gp = grid(c - ctr)
part = inbox & (np.abs((c - ctr) @ n) < cfg.get('thick', 0.06)) & mask[gp[:, 1], gp[:, 0]]
print('part triangles', int(part.sum()), 'core', int(core.sum()), 'centre', ctr.round(3), 'normal', n.round(3))
# rotation taking the plate's normal to the wanted facing (the nearer of +-target)
tgt = np.array(cfg['face']); tgt = tgt / np.linalg.norm(tgt)
if n @ tgt < 0: tgt = -tgt
Rm = trimesh.geometry.align_vectors(n, tgt)[:3, :3]
dest = np.array(cfg['to'])
pf = F[part]
moved = ((V[pf].reshape(-1, 3) - ctr) @ Rm.T) + dest
moved_uv = UV[pf].reshape(-1, 2)
# patch: same triangles in place, all mapped to one texel of the sample colour
sample_uv = np.array(cfg['patch_uv']) if 'patch_uv' in cfg else None
if sample_uv is None:
    sb = np.all((c > np.array(cfg['sample'][0])) & (c < np.array(cfg['sample'][1])), 1) & (lum < cfg.get('dark', 45))
    # the texel of the sample triangle closest to the sample's median colour
    med = np.median(col[sb], 0)
    best = np.where(sb)[0][np.argmin(np.abs(col[sb] - med).sum(1))]
    sample_uv = UV[F[best]].mean(0)
    print('patch colour', colours(sample_uv[None])[0].round(), 'from', int(sb.sum()), 'triangles')
patch = V[pf].reshape(-1, 3)
keep = F[~part]
nv = len(V)
verts = np.vstack([V, moved, patch])
uvs = np.vstack([UV, moved_uv, np.repeat(sample_uv[None], len(patch), 0)])
k = len(pf)
faces = np.vstack([keep, nv + np.arange(3 * k).reshape(-1, 3), nv + 3 * k + np.arange(3 * k).reshape(-1, 3)])
if 'name' in cfg:
    # the moved part as its own mesh, so a rig can take it whole whatever it overlaps
    body = np.vstack([keep, nv + 3 * k + np.arange(3 * k).reshape(-1, 3)])
    mk = lambda f: trimesh.Trimesh(verts, f, process=False, visual=trimesh.visual.TextureVisuals(uv=uvs, material=s.visual.material))
    scene = trimesh.Scene()
    scene.add_geometry(mk(body), node_name='body', geom_name='body')
    scene.add_geometry(mk(nv + np.arange(3 * k).reshape(-1, 3)), node_name=cfg['name'], geom_name=cfg['name'])
    for g in scene.geometry.values(): g.remove_unreferenced_vertices()
    scene.export(dst)
else:
    out = trimesh.Trimesh(verts, faces, process=False, visual=trimesh.visual.TextureVisuals(uv=uvs, material=s.visual.material))
    out.export(dst)
print('wrote', dst, len(faces), 'faces')
