# uvmask.py model.glb tex_like.png out.png "<test on x,y,z>": the texels of the triangles passing the test
import sys
import numpy as np, trimesh
from PIL import Image, ImageDraw
s = trimesh.load(sys.argv[1], force='mesh', process=False)
W, H = Image.open(sys.argv[2]).size
test = eval('lambda x, y, z: ' + sys.argv[4])
C = s.vertices[s.faces].mean(1)
m = Image.new('L', (W, H), 0); d = ImageDraw.Draw(m)
for t in np.where([test(*p) for p in C])[0]:
    d.polygon([(u * W, (1 - v) * H) for u, v in s.visual.uv[s.faces[t]]], fill=255)
m.save(sys.argv[3])
