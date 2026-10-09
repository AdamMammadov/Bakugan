# fitfast.py model.glb ref.png out.json [yaw_deg_range]
# fitview.py's search, with the silhouette splatted from surface samples instead of drawing every
# triangle (fast on dense meshes). Same JSON out, plus an overlay PNG next to it.
import sys, json, math
import numpy as np, trimesh
from PIL import Image
from scipy import ndimage
s = trimesh.load(sys.argv[1], force='mesh', process=False)
P3, _ = trimesh.sample.sample_surface(s, 400000, seed=1)
P3 = np.vstack([P3, s.vertices])
ref = np.array(Image.open(sys.argv[2]).convert('RGBA'))[..., 3] > 20
R = 256; N = ref.shape[0]
refs = np.array(Image.fromarray(ref.astype(np.uint8) * 255).resize((R, R))) > 127
def raster(yaw, scale, ox, oy):
    c, sn = math.cos(yaw), math.sin(yaw)
    px = ((P3[:, 0] * c + P3[:, 2] * sn) * scale + ox) * R / N; py = ((-P3[:, 1]) * scale + oy) * R / N
    ok = (px >= 0) & (px < R) & (py >= 0) & (py < R)
    m = np.zeros((R, R), bool); m[py[ok].astype(int), px[ok].astype(int)] = True
    return ndimage.binary_closing(m, iterations=1)
def iou(m): return (m & refs).sum() / max((m | refs).sum(), 1)
V = s.vertices
ys, xs = np.where(ref)
scale0 = (ys.max() - ys.min()) / (V[:, 1].max() - V[:, 1].min())
ox0 = (xs.min() + xs.max()) / 2 - scale0 * (V[:, 0].min() + V[:, 0].max()) / 2
oy0 = ys.min() + scale0 * V[:, 1].max()
best = (iou(raster(0, scale0, ox0, oy0)), 0, scale0, ox0, oy0)
yr = float(sys.argv[4]) if len(sys.argv) > 4 else 10
for it, (ds, dd, dy) in enumerate(((0.12, 40, yr), (0.05, 16, yr / 2.5), (0.02, 6, yr / 5), (0.008, 2, yr / 10))):
    yaw0, sc0, oxb, oyb = best[1:]
    for yaw in np.radians(np.linspace(-dy, dy, 5)) + yaw0:
        for sc in sc0 * (1 + np.linspace(-ds, ds, 5)):
            for ox in oxb + np.linspace(-dd, dd, 5):
                for oy in oyb + np.linspace(-dd, dd, 5):
                    v = iou(raster(yaw, sc, ox, oy))
                    if v > best[0]: best = (v, yaw, sc, ox, oy)
    print('round', it, 'iou %.3f yaw %.1f scale %.1f ox %.1f oy %.1f' % (best[0], math.degrees(best[1]), best[2], best[3], best[4]))
json.dump({'yaw': best[1], 'scale': best[2], 'ox': best[3], 'oy': best[4], 'iou': best[0], 'size': N}, open(sys.argv[3], 'w'))
m = raster(*best[1:])
over = np.zeros((R, R, 3), np.uint8); over[..., 0] = refs * 255; over[..., 1] = m * 255
Image.fromarray(over).resize((512, 512)).save(sys.argv[3].replace('.json', '.png'))
