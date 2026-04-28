"""Seed the crops and diseases tables from class_names.json.

Run from the backend/ folder with venv active:
    python -m scripts.seed_crops_and_diseases

Idempotent — safe to re-run. Skips records that already exist.
"""

import asyncio
import json
from pathlib import Path

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.crop import Crop
from app.models.disease import Disease


# Path to the class_names.json file we exported from Week 1
CLASS_NAMES_PATH = Path(__file__).parent.parent / "ml" / "class_names.json"


def parse_class_name(class_name: str) -> tuple[str, str]:
    """
    Split a model class name like 'Tomato___Late_blight' into (crop, disease).
    Some names have spaces or parentheses — keep them readable.
    """
    crop_raw, disease_raw = class_name.split("___", 1)
    crop_name = crop_raw.replace("_", " ").strip()
    disease_name = disease_raw.replace("_", " ").strip()
    return crop_name, disease_name


async def seed():
    # 1. Load class names
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        class_names = json.load(f)

    print(f"Loaded {len(class_names)} class names from {CLASS_NAMES_PATH.name}")

    async with AsyncSessionLocal() as db:
        # 2. Build the set of unique crops
        unique_crops = set()
        parsed = []
        for cn in class_names:
            crop_name, disease_name = parse_class_name(cn)
            unique_crops.add(crop_name)
            parsed.append((cn, crop_name, disease_name))

        print(f"Found {len(unique_crops)} unique crops")

        # 3. Insert crops (skip ones already in DB)
        existing_crops = await db.execute(select(Crop.name))
        existing_crop_names = {row[0] for row in existing_crops.all()}

        crop_id_by_name: dict[str, "Crop"] = {}

        for crop_name in sorted(unique_crops):
            if crop_name in existing_crop_names:
                # Already in DB — fetch it for our id-lookup map
                result = await db.execute(
                    select(Crop).where(Crop.name == crop_name)
                )
                crop = result.scalar_one()
                print(f"  - skip existing crop: {crop_name}")
            else:
                crop = Crop(name=crop_name)
                db.add(crop)
                await db.flush()  # populates crop.id without committing
                print(f"  + new crop: {crop_name}")
            crop_id_by_name[crop_name] = crop

        # 4. Insert diseases
        existing_diseases = await db.execute(select(Disease.model_class_name))
        existing_disease_names = {row[0] for row in existing_diseases.all()}

        new_disease_count = 0
        for class_name, crop_name, disease_name in parsed:
            if class_name in existing_disease_names:
                continue
            crop = crop_id_by_name[crop_name]
            display = (
                f"Healthy {crop_name}"
                if disease_name.lower() == "healthy"
                else f"{crop_name} {disease_name}"
            )
            disease = Disease(
                crop_id=crop.id,
                model_class_name=class_name,
                display_name=display,
                is_contagious=False,
            )
            db.add(disease)
            new_disease_count += 1
            print(f"  + new disease: {display}")

        await db.commit()
        print(f"\nDone. Added {new_disease_count} new diseases.")


if __name__ == "__main__":
    asyncio.run(seed())