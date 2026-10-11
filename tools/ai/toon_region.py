# toon_region.py model.glb ref.png tex_in tex_out mask.png "<ref pixel test on px,py>" [levels]
# Cel-shades the masked texels after a picture: their lightness is matched to the picture region's,
# coloured with the picture's own colour at that lightness, and stepped into a few tones with crisp
# edges (narrow ramps), so blurry generated paint reads like the drawn art.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
tex = np.array(Image.open(sys.argv[3]).convert('RGB')).astype(float)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA')).astype(float)
mask = np.array(Image.open(sys.argv[5])) > 0
rtest = eval('lambda px, py: ' + sys.argv[6]); levels = int(sys.argv[7]) if len(sys.argv) > 7 else 4
yy, xx = np.mgrid[0:ref.shape[0], 0:ref.shape[1]]
rm = (ref[..., 3] > 200) & rtest(xx, yy)
R = ref[rm][:, :3]
lum = lambda c: c @ np.array([0.3, 0.59, 0.11])
rl = lum(R)
# the picture's colour at each lightness (mean colour of its pixels in 64 lightness bins)
bins = np.clip((rl / 256 * 64).astype(int), 0, 63)
lut = np.zeros((64, 3)); cnt = np.bincount(bins, minlength=64)
for k in range(3): lut[:, k] = np.bincount(bins, weights=R[:, k], minlength=64) / np.maximum(cnt, 1)
filled_bins = cnt > 20
lut = np.stack([np.interp(np.arange(64), np.where(filled_bins)[0], lut[filled_bins, k]) for k in range(3)], 1)
# smooth the texture inside the mask a little (median) without bleeding across island edges
_, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
src = tex[iy, ix]
med = np.stack([ndimage.median_filter(src[..., k], size=3) for k in range(3)], -1)
tl = lum(med[mask])
# lightness matched to the picture's distribution
order = np.argsort(tl); q = np.empty_like(tl); q[order] = np.linspace(0, 1, len(tl))
ml = np.percentile(rl, q * 100)
# stepped into tones: each level's ramp only a few percent wide
lo, hi = np.percentile(rl, 2), np.percentile(rl, 98)
t = np.clip((ml - lo) / (hi - lo), 0, 1) * (levels - 1)
k = np.floor(t); f = t - k
ramp = np.clip((f - 0.5) / 0.12 + 0.5, 0, 1)
ts = (k + ramp) / (levels - 1)
sl = lo + ts * (hi - lo)
col = np.stack([np.interp(sl / 256 * 64, np.arange(64), lut[:, c]) for c in range(3)], 1)
out = tex.copy(); out[mask] = col
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(sys.argv[4])
print('texels', int(mask.sum()), 'picture pixels', int(rm.sum()))
