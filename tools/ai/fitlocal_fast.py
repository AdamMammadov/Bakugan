# fitlocal_fast.py model.glb ref.png fit.json out.json x0 y0 x1 y1 : fitlocal.py's search (silhouette IoU inside one
# window of the picture), with the silhouette splatted from dense surface samples so big windows stay quick.
import sys, json, math
import numpy as np, trimesh
from PIL import Image
from scipy import ndimage
s = trimesh.load(sys.argv[1], force='mesh', process=False)
P3, _ = trimesh.sample.sample_surface(s, 1_500_000, seed=2)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA'))[..., 3] > 20
f0 = json.load(open(sys.argv[3]))
x0, y0, x1, y1 = map(int, sys.argv[5:9])
win = ref[y0:y1, x0:x1]; Hh, Ww = win.shape
def raster(yaw, scale, ox, oy):
    c, sn = math.cos(yaw), math.sin(yaw)
    px = ((P3[:, 0] * c + P3[:, 2] * sn) * scale + ox - x0).astype(int)
    py = (-P3[:, 1] * scale + oy - y0).astype(int)
    ok = (px >= 0) & (px < Ww) & (py >= 0) & (py < Hh)
    m = np.zeros((Hh, Ww), bool); m[py[ok], px[ok]] = True
    return ndimage.binary_closing(m, iterations=2)
def iou(m): return (m & win).sum() / max((m | win).sum(), 1)
best = (iou(raster(f0['yaw'], f0['scale'], f0['ox'], f0['oy'])), f0['yaw'], f0['scale'], f0['ox'], f0['oy'])
print('start iou %.3f' % best[0])
for ds, dd, dy in ((0.12, 30, 8), (0.05, 12, 4), (0.02, 5, 2), (0.008, 2, 1)):
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
Image.fromarray(over).save(sys.argv[4].replace('.json', '.png'))
