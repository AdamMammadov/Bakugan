# lighten_region.py model.glb tex_in tex_out "<python test on x,y,z>" [floor=0.62]
# Turns dark, colourless texels of the triangles whose centre passes the test into light grey and
# white (the generator sometimes paints white armour black), keeping their light and shade.
import sys
import numpy as np, trimesh
from PIL import Image
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv)
tex = np.array(Image.open(sys.argv[2]).convert('RGB')).astype(float); TH, TW = tex.shape[:2]
test = eval('lambda x, y, z: ' + sys.argv[4])
floor = float(sys.argv[5]) if len(sys.argv) > 5 else 0.62
c = V[F].mean(1)
sel = np.where(np.array([test(*p) for p in c]))[0]
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
    mask[vmin:vmax, umin:umax] |= (l0 >= -0.1) & (l1 >= -0.1) & (1 - l0 - l1 >= -0.1)
T = tex[mask]
lum = T.mean(1) / 255; sat = (T.max(1) - T.min(1)) / 255
# how dark and colourless a texel is: 1 for black-grey, fading out towards mid grey and colour
w = np.clip((0.45 - lum) / 0.15, 0, 1) * np.clip((0.22 - sat) / 0.1, 0, 1)
grey = (floor + (1 - floor) * np.clip(lum / 0.4, 0, 1)) * 255
new = np.stack([grey * 0.97, grey * 0.98, grey], 1)  # a cool white like the art
tex[mask] = T * (1 - w[:, None]) + new * w[:, None]
Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(sys.argv[3])
print('triangles', len(sel), 'texels', int(mask.sum()), 'lightened', int((w > 0.5).sum()))
