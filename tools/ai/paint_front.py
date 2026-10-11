# paint_front.py model.glb tex_in tex_out zmin '<json shapes>' [min facing] [yaw]: paints flat shapes drawn in the model's front
# view (x right, y up, model units) onto the front-most surface facing +z (z-buffered, so only what the front
# camera sees). Shapes are drawn in order: {"poly": [[x,y],...], "fill": [r,g,b]}, {"line": [[x,y],...],
# "width": w, "fill": [r,g,b]}; an optional "mirror": true adds the x -> -x copy.
import sys, json, numpy as np, trimesh
from PIL import Image, ImageDraw
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices, float); F = np.asarray(s.faces); UV = np.asarray(s.visual.uv, float)
# yaw (7th argument, radians): paint as seen with the model turned by this much about the up axis, as the
# converter's yaw does, for a face that looks off to one side
yaw = float(sys.argv[7]) if len(sys.argv) > 7 else 0.0
if yaw:
    cy_, sy_ = np.cos(yaw), np.sin(yaw)
    V = np.stack([V[:, 0] * cy_ + V[:, 2] * sy_, V[:, 1], -V[:, 0] * sy_ + V[:, 2] * cy_], 1)
    s = trimesh.Trimesh(V, s.faces, process=False, visual=s.visual)
tex = np.array(Image.open(sys.argv[2]).convert('RGB')).astype(float); TH, TW = tex.shape[:2]
zmin = float(sys.argv[4]); shapes = json.loads(sys.argv[5])
K = 4000  # canvas pixels per model unit
allp = np.array([p for sh in shapes for p in sh.get('poly', sh.get('line'))])
x0, y0 = allp.min(0) - 0.02; x1, y1 = allp.max(0) + 0.02
x0, x1 = min(x0, -x1), max(x1, -x0)
W, H = int((x1 - x0) * K), int((y1 - y0) * K)
canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(canvas)
P = lambda pts: [((x - x0) * K, (y1 - y) * K) for x, y in pts]
for sh in shapes:
    for mir in ([False, True] if sh.get('mirror') else [False]):
        pts = sh.get('poly', sh.get('line'))
        if mir: pts = [[-x, y] for x, y in pts]
        if 'poly' in sh: d.polygon(P(pts), fill=tuple(sh['fill']) + (255,))
        else: d.line(P(pts), fill=tuple(sh['fill']) + (255,), width=max(1, int(sh['width'] * K)), joint='curve')
cv = np.array(canvas).astype(float)
# front-most surface per canvas pixel
C = V[F].mean(1)
# only surfaces turned towards the front (normal z above the 6th argument), so nothing smears down the sides
nz = s.face_normals[:, 2]; nmin = float(sys.argv[6]) if len(sys.argv) > 6 else 0.3
cand = np.where((C[:, 0] > x0) & (C[:, 0] < x1) & (C[:, 1] > y0) & (C[:, 1] < y1) & (C[:, 2] > zmin))[0]
zcand = cand
cand = cand[nz[cand] > nmin]
S = 0.25  # z-buffer at a quarter of the canvas resolution
zb = np.full((int(H * S) + 1, int(W * S) + 1), -1e9)
for t in zcand:
    x = (V[F[t], 0] - x0) * K * S; y = (y1 - V[F[t], 1]) * K * S; z = V[F[t], 2]
    xmin, xmax = int(max(x.min(), 0)), int(min(x.max() + 1, zb.shape[1])); ymin, ymax = int(max(y.min(), 0)), int(min(y.max() + 1, zb.shape[0]))
    if xmin >= xmax or ymin >= ymax: continue
    gy, gx = np.mgrid[ymin:ymax, xmin:xmax] + 0.5
    den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
    if abs(den) < 1e-12: continue
    l0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / den
    l1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / den
    l2 = 1 - l0 - l1; m = (l0 >= 0) & (l1 >= 0) & (l2 >= 0)
    Z = l0 * z[0] + l1 * z[1] + l2 * z[2]
    sub = zb[ymin:ymax, xmin:xmax]; upd = m & (Z > sub); sub[upd] = Z[upd]
out = tex.copy(); n = 0
eps = float(__import__("os").environ.get("PAINT_EPS", "0.004"))  # depth tolerance (model units)
for t in cand:
    a, b, c = F[t]
    u = UV[[a, b, c], 0] * TW; v = (1 - UV[[a, b, c], 1]) * TH
    umin, umax = int(max(u.min() - 2, 0)), int(min(u.max() + 3, TW)); vmin, vmax = int(max(v.min() - 2, 0)), int(min(v.max() + 3, TH))
    if umin >= umax or vmin >= vmax: continue
    gv, gu = np.mgrid[vmin:vmax, umin:umax] + 0.5
    den = (v[1] - v[2]) * (u[0] - u[2]) + (u[2] - u[1]) * (v[0] - v[2])
    if abs(den) < 1e-12: continue
    l0 = ((v[1] - v[2]) * (gu - u[2]) + (u[2] - u[1]) * (gv - v[2])) / den
    l1 = ((v[2] - v[0]) * (gu - u[2]) + (u[0] - u[2]) * (gv - v[2])) / den
    l2 = 1 - l0 - l1; m = (l0 >= -0.05) & (l1 >= -0.05) & (l2 >= -0.05)
    if not m.any(): continue
    X = l0 * V[a, 0] + l1 * V[b, 0] + l2 * V[c, 0]; Y = l0 * V[a, 1] + l1 * V[b, 1] + l2 * V[c, 1]; Z = l0 * V[a, 2] + l1 * V[b, 2] + l2 * V[c, 2]
    cx = ((X - x0) * K).astype(int).clip(0, W - 1); cy = ((y1 - Y) * K).astype(int).clip(0, H - 1)
    front = Z >= zb[(cy * S).astype(int).clip(0, zb.shape[0] - 1), (cx * S).astype(int).clip(0, zb.shape[1] - 1)] - eps
    col = cv[cy, cx]; w = (col[..., 3] / 255) * m * front
    yy, xx = np.where(w > 0)
    out[yy + vmin, xx + umin] = out[yy + vmin, xx + umin] * (1 - w[yy, xx, None]) + col[yy, xx, :3] * w[yy, xx, None]
    n += len(yy)
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(sys.argv[3])
canvas.save(sys.argv[3].replace('.png', '-canvas.png'))
print('texels painted', n)
