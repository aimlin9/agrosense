"""
generate_app_icons.py

Generates Expo app icon assets from the AgroSense source logo (direction-a-1).

Outputs four PNGs to mobile/assets/:
  - icon.png              1024x1024  Full logo, opaque (iOS, web fallback)
  - adaptive-icon.png     1024x1024  Logo at 70% scale, transparent canvas
                                     (Android adaptive icon foreground)
  - splash-icon.png       1024x1024  Logo at 45% scale, transparent canvas
                                     (Splash screen logo)
  - favicon.png             48x48    Full logo, small (Web favicon)

Existing files in mobile/assets/ are backed up to *.backup before overwriting.

Usage:
    python generate_app_icons.py

Requires: Pillow (pip install Pillow)
"""

from pathlib import Path
from PIL import Image

# === CONFIG ===========================================================
PROJECT_ROOT = Path(r"C:\Users\orams\Projects\agrosense")
SOURCE_DIR = PROJECT_ROOT / "docs" / "logo-options"
OUTPUT_DIR = PROJECT_ROOT / "mobile" / "assets" / "images"

# Source filename — script tries each in order until one is found
SOURCE_CANDIDATES = ["direction-a-1.png", "direction-a-1.jpg"]

# Brand color — matches A-1's dark green background
# Used as opaque fill for non-transparent assets and as the seamless
# join color in app.json adaptiveIcon.backgroundColor
BG_COLOR_HEX = "#0F5427"

# Asset specs: (filename, canvas_size, logo_scale_pct, transparent_canvas)
#   logo_scale_pct      — % of canvas the logo occupies (centered)
#   transparent_canvas  — True = transparent fill around logo
#                         False = opaque BG_COLOR_HEX fill
ASSETS = [
    ("icon.png",                    1024, 100, False),
    ("android-icon-foreground.png", 1024,  70, True),
    ("splash-icon.png",             1024,  45, True),
    ("favicon.png",                   48, 100, False),
]


# === HELPERS ==========================================================
def hex_to_rgba(hex_str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def find_source():
    for name in SOURCE_CANDIDATES:
        path = SOURCE_DIR / name
        if path.exists():
            return path
    raise FileNotFoundError(
        f"No source logo found in {SOURCE_DIR}\n"
        f"Expected one of: {', '.join(SOURCE_CANDIDATES)}\n"
        f"Edit SOURCE_CANDIDATES in this script if your file is named differently."
    )


def backup_existing(output_dir, asset_filenames):
    backed_up = []
    for filename in asset_filenames:
        existing = output_dir / filename
        if existing.exists():
            backup = existing.with_name(existing.name + ".backup")
            if backup.exists():
                backup.unlink()
            existing.rename(backup)
            backed_up.append(filename)
    return backed_up


def generate_asset(source_img, output_path, canvas_size,
                   logo_scale_pct, transparent_canvas, bg_rgba):
    logo_size = int(canvas_size * logo_scale_pct / 100)

    # Create canvas (transparent or opaque brand color)
    fill = (0, 0, 0, 0) if transparent_canvas else bg_rgba
    canvas = Image.new("RGBA", (canvas_size, canvas_size), fill)

    # High-quality resize
    logo_resized = source_img.resize((logo_size, logo_size), Image.LANCZOS)

    # Center the logo on the canvas
    paste_x = (canvas_size - logo_size) // 2
    paste_y = (canvas_size - logo_size) // 2
    canvas.paste(logo_resized, (paste_x, paste_y), logo_resized)

    canvas.save(output_path, "PNG", optimize=True)


# === MAIN =============================================================
def main():
    print("AgroSense — Expo asset generator\n")

    source_path = find_source()
    print(f"  Source: {source_path}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"  Output: {OUTPUT_DIR}\n")

    asset_filenames = [a[0] for a in ASSETS]
    backed_up = backup_existing(OUTPUT_DIR, asset_filenames)
    if backed_up:
        print(f"  Backed up: {', '.join(backed_up)}\n")

    source_img = Image.open(source_path).convert("RGBA")
    print(f"  Loaded source ({source_img.size[0]}x{source_img.size[1]})\n")

    bg_rgba = hex_to_rgba(BG_COLOR_HEX)
    print("  Generating assets:")
    for filename, canvas_size, scale_pct, transparent in ASSETS:
        output_path = OUTPUT_DIR / filename
        generate_asset(source_img, output_path, canvas_size,
                       scale_pct, transparent, bg_rgba)
        scale_label = f"{scale_pct}%" if scale_pct < 100 else "full"
        bg_label = "transparent" if transparent else BG_COLOR_HEX
        print(f"    {filename:<22} {canvas_size}x{canvas_size}  "
              f"logo={scale_label:<5}  bg={bg_label}")

    print(f"\nDone. {len(ASSETS)} files written to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()