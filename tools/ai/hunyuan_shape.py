"""Turns one picture of a Bakugan into an untextured 3D shape with Hunyuan3D-2mini (Tencent), on CPU.

The picture needs a transparent background and the whole Bakugan in it. A pose with a body (arms,
legs, folded or half-open wings) works; wings spread flat across the whole picture come out as a
flat slab (the network reads it as a poster), here and in the online TRELLIS.2 alike.

Setup (CPU is enough: about 70 s per shape on a 4-core Xeon with AMX, in bfloat16):
    git clone --depth 1 https://github.com/Tencent-Hunyuan/Hunyuan3D-2.git
    python3 -m venv --system-site-packages venv   # keeps the system's CPU torch
    venv/bin/pip install "numpy==1.26.4" "diffusers==0.35.2" "transformers==4.57.*" "huggingface-hub<1.0" \
        einops omegaconf opencv-python-headless pymeshlab accelerate xatlas
    venv/bin/pip install --no-deps torchvision --index-url https://download.pytorch.org/whl/cpu
    # weights (about 4 GB) from https://huggingface.co/tencent/Hunyuan3D-2mini, laid out as
    # <models>/tencent/Hunyuan3D-2mini/hunyuan3d-dit-v2-mini-turbo/{config.yaml,model.fp16.safetensors}
    # <models>/tencent/Hunyuan3D-2mini/hunyuan3d-vae-v2-mini-turbo/{config.yaml,model.fp16.safetensors}

Usage: venv/bin/python tools/ai/hunyuan_shape.py <Hunyuan3D-2 dir> <models dir> out_dir a.png[,b.png] seed1[,seed2]
Writes out_dir/<picture>-s<seed>.glb for each picture and seed (the model loads once). Then texture it from
the same picture with tools/ai/bake_views.py, and ink and rig it like any other model.

Licence: Tencent Hunyuan 3D 2.0 Community Licence (not valid in the EU, UK and South Korea; Tencent claims
no rights in the outputs).
"""
import os
import sys
import time

repo, models, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
srcs, seeds = sys.argv[4].split(','), [int(s) for s in sys.argv[5].split(',')]
os.environ['HY3DGEN_MODELS'] = os.path.abspath(models)
sys.path.insert(0, os.path.abspath(repo))

import torch  # noqa: E402
from PIL import Image  # noqa: E402
from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline  # noqa: E402
from hy3dgen.shapegen.models.autoencoders import surface_extractors  # noqa: E402

# marching cubes runs in numpy, which has no bfloat16
_run = surface_extractors.MCSurfaceExtractor.run
surface_extractors.MCSurfaceExtractor.run = lambda self, grid, **kw: _run(self, grid.float(), **kw)

torch.set_num_threads(os.cpu_count())
t0 = time.time()
pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
    'tencent/Hunyuan3D-2mini', subfolder='hunyuan3d-dit-v2-mini-turbo', device='cpu', dtype=torch.bfloat16
)
pipe.enable_flashvdm(mc_algo='mc')
pipe.vae.to(dtype=torch.bfloat16)
print(f'loaded in {time.time() - t0:.0f}s', flush=True)

os.makedirs(out_dir, exist_ok=True)
for src in srcs:
    image = Image.open(src).convert('RGBA')
    name = os.path.splitext(os.path.basename(src))[0]
    for seed in seeds:
        t0 = time.time()
        with torch.inference_mode():
            mesh = pipe(
                image=image,
                num_inference_steps=5,
                guidance_scale=5.0,
                octree_resolution=380,
                num_chunks=20000,
                generator=torch.manual_seed(seed),
                output_type='trimesh',
            )[0]
        out = os.path.join(out_dir, f'{name}-s{seed}.glb')
        mesh.export(out)
        print(f'{out}: {time.time() - t0:.0f}s, {len(mesh.faces)} faces', flush=True)
