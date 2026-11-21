import os
from PIL import Image, ImageDraw, ImageFont

def create_google_branding_logo():
    # 512x512 canvas with #0D0D0D dark background or clean subtle gradient
    size = (512, 512)
    img = Image.new("RGBA", size, (13, 13, 16, 255))
    draw = ImageDraw.Draw(img)

    # Load source red logo
    src_logo_path = "web/public/logo.png"
    if not os.path.exists(src_logo_path):
        src_logo_path = "web/public/figma/selloi-logo.png"
    
    src = Image.open(src_logo_path).convert("RGBA")
    
    # Scale emblem to 260x260 and place in upper portion
    emblem_size = 250
    emblem = src.resize((emblem_size, emblem_size), Image.Resampling.LANCZOS)
    emblem_x = (512 - emblem_size) // 2
    emblem_y = 60
    img.paste(emblem, (emblem_x, emblem_y), emblem)

    # Try to load Quicksand or Arial font
    font = None
    font_paths = [
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "C:\\Windows\\Fonts\\calibri.ttf",
    ]
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 68)
                break
            except Exception:
                continue
    if font is None:
        font = ImageFont.load_default()

    text = "Selloi"
    # Calculate text bounding box
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_x = (512 - text_width) // 2
    text_y = 350

    # Draw text in crisp white with high contrast
    draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    # Subtext "AI" in brand red
    sub_font = None
    for fp in font_paths:
        if os.path.exists(fp):
            try:
                sub_font = ImageFont.truetype(fp, 26)
                break
            except Exception:
                continue
    if sub_font:
        sub_text = "TELEGRAM AI SALES"
        sub_bbox = draw.textbbox((0, 0), sub_text, font=sub_font)
        sub_w = sub_bbox[2] - sub_bbox[0]
        sub_x = (512 - sub_w) // 2
        draw.text((sub_x, 435), sub_text, fill=(255, 76, 99, 230), font=sub_font)

    # Save to public directory
    os.makedirs("web/public/branding", exist_ok=True)
    out_path_512 = "web/public/branding/selloi-google-oauth-logo.png"
    img.save(out_path_512, "PNG")
    print(f"Saved 512x512 logo: {out_path_512}")

    # Also save 120x120 version
    img_120 = img.resize((120, 120), Image.Resampling.LANCZOS)
    out_path_120 = "web/public/branding/selloi-google-oauth-logo-120.png"
    img_120.save(out_path_120, "PNG")
    print(f"Saved 120x120 logo: {out_path_120}")

if __name__ == "__main__":
    create_google_branding_logo()
