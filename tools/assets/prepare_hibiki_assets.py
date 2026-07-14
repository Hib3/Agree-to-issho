from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "HibikiMade"
CHARACTER_OUTPUT = ROOT / "public/assets/characters/main/fullbody/approved"
BACKGROUND_OUTPUT = ROOT / "public/assets/backgrounds"

CHARACTERS = {
    "01_aguri_embarrassed.png": "aguri_embarrassed.png",
    "02_aguri_lonely.png": "aguri_lonely.png",
    "03_aguri_surprised.png": "aguri_surprised.png",
    "04_aguri_proud.png": "aguri_proud.png",
    "05_aguri_idle_blink.png": "aguri_idle_blink.png",
    "06_aguri_talk_normal.png": "aguri_talk_normal.png",
}


def remove_green_screen(image: Image.Image) -> Image.Image:
    rgba = np.asarray(image.convert("RGBA"), dtype=np.float32).copy()
    rgb = rgba[..., :3]
    red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    strongest_other = np.maximum(red, blue)
    dominance = green - strongest_other

    green_strength = np.clip((green - 145.0) / 70.0, 0.0, 1.0)
    dominance_strength = np.clip((dominance - 50.0) / 105.0, 0.0, 1.0)
    key_strength = green_strength * dominance_strength
    key_strength[(green > 215.0) & (dominance > 120.0)] = 1.0

    rgba[..., 3] *= 1.0 - key_strength
    spill_zone = (rgba[..., 3] > 0.0) & (dominance > 28.0) & (green > 135.0)
    neutral_green = strongest_other + 24.0
    rgba[..., 1] = np.where(spill_zone, np.minimum(green, neutral_green), green)
    rgba[rgba[..., 3] < 2.0, :3] = 0.0
    rgba[rgba[..., 3] < 2.0, 3] = 0.0
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def qa_character(path: Path) -> dict[str, int | float | str]:
    rgba = np.asarray(Image.open(path).convert("RGBA"))
    alpha = rgba[..., 3]
    rgb = rgba[..., :3].astype(np.int16)
    dominance = rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])
    remaining_neon = int(np.count_nonzero((alpha > 16) & (rgb[..., 1] > 215) & (dominance > 120)))
    return {
        "file": path.name,
        "width": int(rgba.shape[1]),
        "height": int(rgba.shape[0]),
        "transparent_percent": round(float(np.mean(alpha == 0) * 100.0), 2),
        "opaque_percent": round(float(np.mean(alpha == 255) * 100.0), 2),
        "remaining_neon_pixels": remaining_neon,
    }


def main() -> None:
    CHARACTER_OUTPUT.mkdir(parents=True, exist_ok=True)
    BACKGROUND_OUTPUT.mkdir(parents=True, exist_ok=True)
    for source_name, output_name in CHARACTERS.items():
        prepared = remove_green_screen(Image.open(SOURCE / source_name))
        destination = CHARACTER_OUTPUT / output_name
        prepared.save(destination, optimize=True)
        print(qa_character(destination))

    rainy = Image.open(SOURCE / "07_aguri_room_rainy.png").convert("RGB")
    rainy.save(BACKGROUND_OUTPUT / "aguri_room_rainy.webp", "WEBP", quality=91, method=6)
    print({"file": "aguri_room_rainy.webp", "width": rainy.width, "height": rainy.height})


if __name__ == "__main__":
    main()
