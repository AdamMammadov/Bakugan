"""Turns one picture of a Bakugan into a coloured 3D model with TripoSR (Stability AI, MIT).

The picture should show the whole Bakugan, ideally from the front or three-quarter view, on a
transparent or plain one-colour background. The back of the model is the network's best guess.

Setup (CPU is enough: about 70 s per picture):
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install omegaconf einops transformers==4.39.0 trimesh scikit-image
    # code: https://huggingface.co/spaces/stabilityai/TripoSR (the tsr/ folder)
    # weights: https://huggingface.co/stabilityai/TripoSR (config.yaml, model.ckpt)
    # in tsr/models/isosurface.py, swap torchmcubes for skimage.measure.marching_cubes

Usage: python3 tools/ai/image_to_3d.py <TripoSR dir> picture.png out.glb
Then: npx @gltf-transform/cli simplify out.glb small.glb --ratio 0.15 --error 0.002
and rig it like any other model (tools/preview/rigs.json, convert.html?src=…glb&rig=…).
"""
import sys
import time

import numpy as np
import torch
import trimesh.transformations as tf
from PIL import Image

tsr_dir, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
sys.path.insert(0, tsr_dir)
from tsr.system import TSR  # noqa: E402
from tsr.utils import resize_foreground  # noqa: E402

torch.set_num_threads(4)
img = Image.open(src).convert('RGBA')
a = np.array(img)
if a[:, :, 3].min() == 255:
    # no transparency: treat the colour of the corners as the background and cut it away
    corners = np.array([a[0, 0, :3], a[0, -1, :3], a[-1, 0, :3], a[-1, -1, :3]]).astype(int)
    bg = np.median(corners, 0)
    a[:, :, 3] = np.where(np.abs(a[:, :, :3].astype(int) - bg).sum(2) < 40, 0, 255)
    img = Image.fromarray(a)
img = resize_foreground(img, 0.85)
f = np.array(img).astype(np.float32) / 255.0
rgb = f[:, :, :3] * f[:, :, 3:4] + (1 - f[:, :, 3:4]) * 0.5
img = Image.fromarray((rgb * 255).astype(np.uint8))

t = time.time()
model = TSR.from_pretrained(tsr_dir, config_name='config.yaml', weight_name='model.ckpt')
model.renderer.set_chunk_size(8192)
with torch.no_grad():
    mesh = model.extract_mesh(model([img], device='cpu'), resolution=256)[0]
# TripoSR is Z-up and faces +X: turn it to Y-up, facing +Z like the game's models
mesh.apply_transform(tf.rotation_matrix(-np.pi / 2, [1, 0, 0]))
mesh.apply_transform(tf.rotation_matrix(-np.pi / 2, [0, 1, 0]))
# glTF vertex colours are linear; TripoSR gives sRGB
c = mesh.visual.vertex_colors.astype(np.float32) / 255.0
lin = np.where(c[:, :3] <= 0.04045, c[:, :3] / 12.92, ((c[:, :3] + 0.055) / 1.055) ** 2.4)
mesh.visual.vertex_colors = np.concatenate([lin, c[:, 3:4]], 1)
mesh.export(out)
print('done in', round(time.time() - t), 's:', len(mesh.faces), 'faces')
