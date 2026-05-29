"""一次性壓縮 public/assets PNG(256-color quantize + Floyd-Steinberg dither,保 alpha)。
user 授權覆寫(git 可還原)。4G 開機資產 47MB→~7MB。"""
from PIL import Image
import os, glob

total_o = total_n = 0
files = sorted(glob.glob("public/assets/**/*.png", recursive=True))
for p in files:
    o = os.path.getsize(p)
    img = Image.open(p).convert("RGBA")
    q = img.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.FLOYDSTEINBERG)
    q.save(p, optimize=True)
    n = os.path.getsize(p)
    total_o += o
    total_n += n
    print(f"{os.path.basename(p):46s} {o/1048576:5.2f} -> {n/1048576:5.2f} MB")
print(f"\nTOTAL {len(files)} files: {total_o/1048576:.1f}MB -> {total_n/1048576:.1f}MB ({100*total_n/total_o:.0f}%)")
