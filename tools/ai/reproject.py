# reproject.py model.glb ref.png fit.json tex_in tex_out cx cy rx ry
# Paints the reference picture onto the model's texture inside an ellipse (ref pixel coords,
# centre cx,cy radii rx,ry), only on the triangles the camera actually sees there (z-buffer),
# fading out towards the ellipse edge.
import sys, json, math
import numpy as np, trimesh
from PIL import Image
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices, float); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv, float)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA')).astype(float)
fit = json.load(open(sys.argv[3]))
tex = np.array(Image.open(sys.argv[4]).convert('RGB')).astype(float)
TH, TW = tex.shape[:2]
cx, cy, rx, ry = map(float, sys.argv[6:10])
c, sn = math.cos(fit['yaw']), math.sin(fit['yaw'])
PX = (V[:, 0] * c + V[:, 2] * sn) * fit['scale'] + fit['ox']
PY = -V[:, 1] * fit['scale'] + fit['oy']
PZ = -V[:, 0] * sn + V[:, 2] * c  # towards the camera = larger
def ell(x, y): return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2
# candidate triangles: any vertex inside the ellipse
inside = ell(PX, PY) < 1.0
cand = np.where(inside[F].any(1))[0]
# z-buffer over the ellipse's bounding box at 2x ref resolution
S = 2
bx0, by0 = int(cx - rx) - 2, int(cy - ry) - 2
bw, bh = int(2 * rx) + 5, int(2 * ry) + 5
zb = np.full((bh * S, bw * S), -1e9); idb = np.full((bh * S, bw * S), -1)
gy, gx = np.mgrid[0:bh * S, 0:bw * S]
gxr = gx / S + bx0 + 0.5 / S; gyr = gy / S + by0 + 0.5 / S
for t in cand:
    a, b, d = F[t]
    x = np.array([PX[a], PX[b], PX[d]]); y = np.array([PY[a], PY[b], PY[d]]); z = np.array([PZ[a], PZ[b], PZ[d]])
    xmin, xmax = int(max((x.min() - bx0) * S, 0)), int(min((x.max() - bx0) * S + 1, bw * S))
    ymin, ymax = int(max((y.min() - by0) * S, 0)), int(min((y.max() - by0) * S + 1, bh * S))
    if xmin >= xmax or ymin >= ymax: continue
    X = gxr[ymin:ymax, xmin:xmax]; Y = gyr[ymin:ymax, xmin:xmax]
    den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
    if abs(den) < 1e-9: continue
    l0 = ((y[1] - y[2]) * (X - x[2]) + (x[2] - x[1]) * (Y - y[2])) / den
    l1 = ((y[2] - y[0]) * (X - x[2]) + (x[0] - x[2]) * (Y - y[2])) / den
    l2 = 1 - l0 - l1
    m = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
    Z = l0 * z[0] + l1 * z[1] + l2 * z[2]
    sub = zb[ymin:ymax, xmin:xmax]; ids = idb[ymin:ymax, xmin:xmax]
    upd = m & (Z > sub)
    sub[upd] = Z[upd]; ids[upd] = t
visible = set(np.unique(idb[idb >= 0]).tolist())
print('candidates', len(cand), 'visible', len(visible))
def sample(img, x, y):
    x = np.clip(x, 0, img.shape[1] - 1.001); y = np.clip(y, 0, img.shape[0] - 1.001)
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = x - x0; fy = y - y0
    out = 0
    for dy, wy in ((0, 1 - fy), (1, fy)):
        for dx, wx in ((0, 1 - fx), (1, fx)):
            out = out + img[y0 + dy, x0 + dx] * (wy * wx)[..., None]
    return out
painted = 0
acc = np.zeros(tex.shape[:2]); col = np.zeros(tex.shape)
for t in visible:
    a, b, d = F[t]
    u = UV[[a, b, d], 0] * TW; v = (1 - UV[[a, b, d], 1]) * TH
    umin, umax = int(max(u.min() - 2, 0)), int(min(u.max() + 3, TW))
    vmin, vmax = int(max(v.min() - 2, 0)), int(min(v.max() + 3, TH))
    if umin >= umax or vmin >= vmax: continue
    gv, gu = np.mgrid[vmin:vmax, umin:umax] + 0.5
    den = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
    if abs(den) < 1e-12: continue
    l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / den
    l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / den
    l2 = 1 - l0 - l1
    m = (l0 >= -0.08) & (l1 >= -0.08) & (l2 >= -0.08)  # a little bleed past the edges
    if not m.any(): continue
    X = l0 * PX[a] + l1 * PX[b] + l2 * PX[d]; Y = l0 * PY[a] + l1 * PY[b] + l2 * PY[d]
    rgba = sample(ref, X, Y)
    e = ell(X, Y)
    w = np.clip((1 - e) / 0.35, 0, 1) * (rgba[..., 3] / 255) * m
    yy, xx = np.where(w > 0)
    acc[yy + vmin, xx + umin] = np.maximum(acc[yy + vmin, xx + umin], w[yy, xx])
    col[yy + vmin, xx + umin] = rgba[yy, xx, :3]
    painted += len(yy)
out = tex * (1 - acc[..., None]) + col * acc[..., None]
Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(sys.argv[5], quality=92)
print('texels painted', painted)
