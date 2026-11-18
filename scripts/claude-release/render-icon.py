"""Rasterize the existing LearningHarness mark for directory listing metadata."""
from pathlib import Path
from PIL import Image, ImageDraw
source = Path('website/dist/assets/mark.svg').read_text()
assert 'M0 0h20v80h20V60h20v40H0Z' in source
assert 'M40 0h60v100H80V20H60v20H40Z' in source
size, oversample = 1024, 4
image = Image.new('RGB', (size*oversample, size*oversample), '#191919')
draw = ImageDraw.Draw(image)
for polygon in [[(0,0),(20,0),(20,80),(40,80),(40,60),(60,60),(60,100),(0,100)], [(40,0),(100,0),(100,100),(80,100),(80,20),(60,20),(60,40),(40,40)]]:
    points = [((x+10)*size*oversample/120, (y+10)*size*oversample/120) for x,y in polygon]
    draw.polygon(points, fill='#ff604a')
image.resize((size,size), Image.Resampling.LANCZOS).save('scripts/claude-release/assets/icon.png', optimize=True)
