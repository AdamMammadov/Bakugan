# fitview.py model.glb ref.png out.json [yaw_deg_range]
# Finds the front-view scale/offset (and a small yaw) that best lays the model's silhouette
# over the reference picture's alpha (IoU on a 256 px raster). Front = +Z, image y down.
import sys, json, math
import numpy as np, trimesh
from PIL import Image, ImageDraw
s = trimesh.load(sys.argv[1], force='mesh', process=False)
V = np.asarray(s.vertices); F = np.asarray(s.faces)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA'))[..., 3] > 20
R = 256
refs = np.array(Image.fromarray(ref.astype(np.uint8) * 255).resize((R, R))) > 127
N = ref.shape[0]
def raster(yaw, scale, ox, oy, res=R):
    c, sn = math.cos(yaw), math.sin(yaw)
    x = V[:, 0] * c + V[:, 2] * sn
    y = -V[:, 1]
    px = (x * scale + ox) * res / N; py = (y * scale + oy) * res / N
    im = Image.new('L', (res, res), 0); d = ImageDraw.Draw(im)
    P = np.stack([px, py], 1)[F]
    for tri in P:
        d.polygon([tuple(t) for t in tri], fill=255)
    return np.array(im) > 127
def iou(m): return (m & refs).sum() / max((m | refs).sum(), 1)
# start: match bounding boxes of the vertical extent
ys, xs = np.where(ref)
h_ref = ys.max() - ys.min(); h_mod = V[:, 1].max() - V[:, 1].min()
scale0 = h_ref / h_mod
ox0 = (xs.min() + xs.max()) / 2 - scale0 * (V[:, 0].min() + V[:, 0].max()) / 2
oy0 = ys.min() + scale0 * V[:, 1].max()
best = (0, 0, scale0, ox0, oy0)
for it, (ds, dd, dy) in enumerate(((0.12, 40, 10), (0.05, 16, 4), (0.02, 6, 2))):
    yaw0, sc0, oxb, oyb = best[1], best[2], best[3], best[4]
    for yaw in np.radians(np.arange(-dy, dy + 0.1, dy / 2)) + yaw0:
        for sc in sc0 * (1 + np.linspace(-ds, ds, 5)):
            for ox in oxb + np.linspace(-dd, dd, 5):
                for oy in oyb + np.linspace(-dd, dd, 5):
                    v = iou(raster(yaw, sc, ox, oy))
                    if v > best[0]: best = (v, yaw, sc, ox, oy)
    print('round', it, 'iou %.3f yaw %.1f scale %.1f ox %.1f oy %.1f' % (best[0], math.degrees(best[1]), best[2], best[3], best[4]))
json.dump({'yaw': best[1], 'scale': best[2], 'ox': best[3], 'oy': best[4], 'iou': best[0], 'size': N}, open(sys.argv[3], 'w'))
m = raster(best[1], best[2], best[3], best[4], 512)
r5 = np.array(Image.fromarray(ref.astype(np.uint8) * 255).resize((512, 512))) > 127
over = np.zeros((512, 512, 3), np.uint8); over[..., 0] = r5 * 255; over[..., 1] = m * 255
Image.fromarray(over).save(sys.argv[3].replace('.json', '.png'))
