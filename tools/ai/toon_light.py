# toon_light.py tex_in tex_out mask.png [levels] [ramp]: cel-shades the masked texels keeping their own
# colours: Lab lightness stepped into a few tones with narrow ramps, colour (a, b) median-smoothed.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage import color
tex = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(float) / 255
mask = np.array(Image.open(sys.argv[3])) > 0
levels = int(sys.argv[4]) if len(sys.argv) > 4 else 4; ramp = float(sys.argv[5]) if len(sys.argv) > 5 else 0.12
_, (iy, ix) = ndimage.distance_transform_edt(~mask, return_indices=True)
src = tex[iy, ix]
lab = color.rgb2lab(src)
for k in range(3): lab[..., k] = ndimage.median_filter(lab[..., k], size=3)
L = lab[..., 0][mask]
lo, hi = np.percentile(L, 1), np.percentile(L, 99.5)
t = np.clip((L - lo) / (hi - lo), 0, 1) * (levels - 1)
k = np.floor(t); f = t - k
ts = (k + np.clip((f - 0.5) / ramp + 0.5, 0, 1)) / (levels - 1)
lab_m = lab[mask]; lab_m[:, 0] = lo + ts * (hi - lo)
# a little more colour, like the flat-painted art
lab_m[:, 1:] *= 1.12
out = tex.copy(); out[mask] = np.clip(color.lab2rgb(lab_m[None])[0], 0, 1)
Image.fromarray((out * 255).round().astype(np.uint8)).save(sys.argv[2])
print('texels', int(mask.sum()), 'L range %.0f-%.0f' % (lo, hi))
