# fitlocal.py model.glb ref.png fit.json out.json x0 y0 x1 y1
# Refines a front-view fit so the model's silhouette matches the reference inside one window
# (ref pixel coords), e.g. the head. Raster at full ref resolution, window only.
import sys, json, math
import numpy as np, trimesh
from PIL import Image, ImageDraw
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices); F = np.asarray(s.faces)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA'))[..., 3] > 20
f0 = json.load(open(sys.argv[3]))
x0, y0, x1, y1 = map(int, sys.argv[5:9])
win = ref[y0:y1, x0:x1]
def raster(yaw, scale, ox, oy):
    c, sn = math.cos(yaw), math.sin(yaw)
    px = (V[:, 0] * c + V[:, 2] * sn) * scale + ox - x0
    py = -V[:, 1] * scale + oy - y0
    P = np.stack([px, py], 1)[F]
    keep = (P[..., 0].max(1) > -5) & (P[..., 0].min(1) < x1 - x0 + 5) & (P[..., 1].max(1) > -5) & (P[..., 1].min(1) < y1 - y0 + 5)
    im = Image.new('L', (x1 - x0, y1 - y0), 0); d = ImageDraw.Draw(im)
    for tri in P[keep]:
        d.polygon([tuple(t) for t in tri], fill=255)
    return np.array(im) > 127
def iou(m): return (m & win).sum() / max((m | win).sum(), 1)
best = (iou(raster(f0['yaw'], f0['scale'], f0['ox'], f0['oy'])), f0['yaw'], f0['scale'], f0['ox'], f0['oy'])
print('start iou %.3f' % best[0])
for ds, dd, dy in ((0.15, 30, 8), (0.06, 12, 4), (0.025, 5, 2), (0.01, 2, 1)):
    _, yaw0, sc0, oxb, oyb = best
    for yaw in np.radians(np.linspace(-dy, dy, 5)) + yaw0:
        for sc in sc0 * (1 + np.linspace(-ds, ds, 5)):
            for ox in oxb + np.linspace(-dd, dd, 5):
                for oy in oyb + np.linspace(-dd, dd, 5):
                    v = iou(raster(yaw, sc, ox, oy))
                    if v > best[0]: best = (v, yaw, sc, ox, oy)
    print('iou %.3f yaw %.1f scale %.1f ox %.1f oy %.1f' % (best[0], math.degrees(best[1]), best[2], best[3], best[4]))
json.dump({'yaw': best[1], 'scale': best[2], 'ox': best[3], 'oy': best[4], 'iou': best[0], 'size': ref.shape[0]}, open(sys.argv[4], 'w'))
m = raster(*best[1:])
over = np.zeros(win.shape + (3,), np.uint8); over[..., 0] = win * 255; over[..., 1] = m * 255
Image.fromarray(over).resize(((x1 - x0) * 2, (y1 - y0) * 2)).save(sys.argv[4].replace('.json', '.png'))
