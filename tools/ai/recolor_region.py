# recolor_region.py model.glb tex_in tex_out "<python test on x,y,z>" R G B [gold|red]
# Recolours the gold-ish (or red) texels of the triangles whose centre passes the test (model coords)
# to the given base colour, keeping their light and shade.
import sys
import numpy as np, trimesh
from PIL import Image
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv)
tex = np.array(Image.open(sys.argv[2]).convert('RGB')).astype(float); TH, TW = tex.shape[:2]
test = eval('lambda x, y, z: ' + sys.argv[4])
base = np.array(list(map(float, sys.argv[5:8])))
c = V[F].mean(1)
fuv = UV[F].mean(1)
col = tex[((1 - fuv[:, 1]) * (TH - 1)).astype(int).clip(0, TH - 1), (fuv[:, 0] * (TW - 1)).astype(int).clip(0, TW - 1)]
r, g, b = col.T
mode = sys.argv[8] if len(sys.argv) > 8 else 'gold'
gold = ((r > 140) & (g > 110) & (b < 130) & (r - b > 45)) if mode == 'gold' else ((r > 120) & (r - g > 60) & (r - b > 60))
sel = np.where(gold & np.array([test(*p) for p in c]))[0]
mask = np.zeros((TH, TW), bool)
for t in sel:
    u = UV[F[t], 0] * TW; v = (1 - UV[F[t], 1]) * TH
    umin, umax = int(max(u.min() - 2, 0)), int(min(u.max() + 3, TW)); vmin, vmax = int(max(v.min() - 2, 0)), int(min(v.max() + 3, TH))
    if umin >= umax or vmin >= vmax: continue
    gv, gu = np.mgrid[vmin:vmax, umin:umax] + 0.5
    den = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
    if abs(den) < 1e-12: continue
    l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / den
    l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / den
    m = (l0 >= -0.1) & (l1 >= -0.1) & (1 - l0 - l1 >= -0.1)
    mask[vmin:vmax, umin:umax] |= m
T = tex[mask]
warm = np.clip(((T[:, 0] - T[:, 2]) - 15) / 30, 0, 1) if mode == 'gold' else np.clip(((T[:, 0] - T[:, 1]) - 40) / 30, 0, 1)  # only the target colour, not texels nearby
lum = T.mean(1)
ref = np.median(lum[warm > 0.5]) if (warm > 0.5).any() else lum.mean()
new = base[None, :] * np.clip(lum / ref, 0.2, 1.6)[:, None] ** 1.3
tex[mask] = T * (1 - warm[:, None]) + new * warm[:, None]
Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(sys.argv[3], quality=92)
print('triangles', len(sel), 'texels', int(mask.sum()), 'gold ref lum %.0f' % ref)
