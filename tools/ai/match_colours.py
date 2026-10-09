# match_colours.py model.glb ref.png tex_in tex_out amount [keep.png]
# Moves the texture's colours towards the reference picture's (Lab histogram match of the texels the
# model uses against the figure's opaque pixels), blended in by `amount` (0..1). Texels that differ
# from keep.png (e.g. a face already painted from the picture) are left alone.
import sys
import numpy as np, trimesh
from PIL import Image, ImageDraw
from skimage import color, exposure
s = trimesh.load(sys.argv[1], force='mesh', process=False)
ref = np.array(Image.open(sys.argv[2]).convert('RGBA'))
tex = np.array(Image.open(sys.argv[3]).convert('RGB')) / 255
amt = float(sys.argv[5])
TH, TW = tex.shape[:2]
m = Image.new('L', (TW, TH), 0); d = ImageDraw.Draw(m)
for tri in s.visual.uv[s.faces]:
    d.polygon([(u * TW, (1 - v) * TH) for u, v in tri], fill=255)
sel = np.array(m) > 0
if len(sys.argv) > 6:
    keep = np.array(Image.open(sys.argv[6]).convert('RGB')) / 255
    sel &= np.abs(tex - keep).sum(2) <= 0.02
lab = color.rgb2lab(tex); rl = color.rgb2lab(ref[ref[..., 3] > 230][:, :3] / 255)
src = lab[sel]
matched = np.stack([exposure.match_histograms(src[:, k], rl[:, k]) for k in range(3)], 1)
lab[sel] = src + amt * (matched - src)
Image.fromarray((np.clip(color.lab2rgb(lab), 0, 1) * 255).round().astype(np.uint8)).save(sys.argv[4])
print('texels moved', int(sel.sum()))
