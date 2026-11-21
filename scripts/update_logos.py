import base64
import io
import os
from PIL import Image

src_path = r'C:/Users/Administrator/.gemini/antigravity/brain/1dea3d39-e3e6-4c01-be57-34ecc1b74f8f/.user_uploaded/media_1795252991843_a76e5cce.png'
img = Image.open(src_path).convert('RGBA')

# Clean low-alpha noise
data = img.load()
w, h = img.size
for y in range(h):
    for x in range(w):
        r, g, b, a = data[x, y]
        if a < 25 or (r < 100 and g < 100 and b < 100 and a < 100):
            data[x, y] = (0, 0, 0, 0)

# Crop tight to red mark
bbox = img.split()[-1].getbbox()
cropped = img.crop(bbox)
cw, ch = cropped.size

# 1. Square icon (512x512) for favicons and app icons
square_size = 512
padding_pct = 0.08  # 8% breathing room
avail = int(square_size * (1 - padding_pct * 2))
scale = min(avail / cw, avail / ch)
rw = int(cw * scale)
rh = int(ch * scale)
scaled_icon = cropped.resize((rw, rh), Image.Resampling.LANCZOS)

square_icon = Image.new('RGBA', (square_size, square_size), (0, 0, 0, 0))
ox = (square_size - rw) // 2
oy = (square_size - rh) // 2
square_icon.paste(scaled_icon, (ox, oy), scaled_icon)

# 2. Header logo image (figma/selloi-logo.png)
nav_pad = 20
nav_logo = Image.new('RGBA', (cw + nav_pad * 2, ch + nav_pad * 2), (0, 0, 0, 0))
nav_logo.paste(cropped, (nav_pad, nav_pad), cropped)

# Save PNG files
os.makedirs('web/public/figma', exist_ok=True)
nav_logo.save('web/public/figma/selloi-logo.png', format='PNG')
square_icon.save('web/public/logo.png', format='PNG')

# 192x192 and 512x512 for manifest
square_icon.resize((192, 192), Image.Resampling.LANCZOS).save('web/public/icon-192.png', format='PNG')
square_icon.save('web/public/icon-512.png', format='PNG')

# Apple touch icon (180x180)
square_icon.resize((180, 180), Image.Resampling.LANCZOS).save('web/public/apple-touch-icon.png', format='PNG')

# Multi-resolution ICO (16, 32, 48, 64, 128, 256)
ico_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
square_icon.save('web/public/favicon.ico', format='ICO', sizes=ico_sizes)

# 3. Create High-Quality SVG
buf = io.BytesIO()
square_icon.save(buf, format='PNG')
b64_data = base64.b64encode(buf.getvalue()).decode('utf-8')

svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%" fill="none">
  <defs>
    <filter id="selloi-glow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#FF4C63" flood-opacity="0.35" />
    </filter>
  </defs>
  <image href="data:image/png;base64,{b64_data}" width="512" height="512" filter="url(#selloi-glow)" />
</svg>
'''

with open('web/public/logo.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

with open('web/app/icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

with open('web/app/apple-icon.svg', 'w', encoding='utf-8') as f:
    f.write(svg_content)

if os.path.exists('4-admin-dashboard/public'):
    with open('4-admin-dashboard/public/logo.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)

print('All assets generated successfully!')
