"""Stack (reference, render) pairs into one image: python3 compare.py out.png ref1 r1 ref2 r2 ..."""
import sys

from PIL import Image

out, *files = sys.argv[1:]
pairs = list(zip(files[::2], files[1::2]))
canvas = Image.new('RGB', (1920, 540 * len(pairs)))
for i, (ref, ren) in enumerate(pairs):
    canvas.paste(Image.open(ref).convert('RGB').resize((960, 540)), (0, i * 540))
    canvas.paste(Image.open(ren).convert('RGB').resize((960, 540)), (960, i * 540))
canvas.save(out)
