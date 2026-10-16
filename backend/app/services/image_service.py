"""Image preprocessing service.

Converts arbitrary uploaded images (JPEG, PNG, any size) into the exact
tensor shape MobileNetV2 expects: [1, 224, 224, 3] of float32 in [0, 1].

This module has no side effects — pure functions that take bytes/PIL Images
and return numpy arrays. Easy to unit-test in isolation.
"""

from io import BytesIO

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

# Refuse decompression bombs (a 1 KB PNG that expands to gigapixels).
Image.MAX_IMAGE_PIXELS = 40_000_000


# Must match what we used in Week 1 training (see agrosense_training.ipynb)
TARGET_SIZE = (224, 224)


class ImageProcessingError(Exception):
    """Raised when an uploaded file can't be processed as a valid image."""


def load_image_from_bytes(file_bytes: bytes) -> Image.Image:
    """Decode raw bytes into a PIL Image. Raises ImageProcessingError if not a valid image."""
    try:
        image = Image.open(BytesIO(file_bytes))
        # Force load now (PIL is lazy) so any errors surface immediately
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise ImageProcessingError(
            "That file isn't a photo we can read. Please upload a JPEG or PNG image."
        ) from e

    # Phones store rotation in EXIF; apply it so the model sees the leaf upright.
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    if min(image.size) < 32:
        raise ImageProcessingError("This photo is too small. Please take a closer picture of the leaf.")

    return image


def preprocess_for_inference(image: Image.Image) -> np.ndarray:
    """Convert a PIL Image into the tensor MobileNetV2 expects.

    Steps:
      1. Convert to RGB (handles RGBA/grayscale/CMYK uploads cleanly)
      2. Resize to 224x224 with bilinear interpolation (matches Keras default)
      3. Convert to numpy float32 array
      4. Add batch dimension → [1, 224, 224, 3]

    Note: we do NOT divide by 255 here. MobileNetV2's preprocess_input
    is baked into the saved model, so we feed [0, 255] floats directly.

    Returns:
        A numpy array of shape [1, 224, 224, 3], dtype float32.
    """
    # 1. Force RGB. Drops alpha channel from PNG with transparency,
    #    expands grayscale to 3 channels, etc.
    if image.mode != "RGB":
        image = image.convert("RGB")

    # 2. Resize. PIL.Image.Resampling.BILINEAR matches Keras's default
    #    image_dataset_from_directory interpolation we used in training.
    image = image.resize(TARGET_SIZE, Image.Resampling.BILINEAR)

    # 3. To numpy array — uint8 [0, 255]
    array = np.asarray(image, dtype=np.float32)

    # 4. Add batch dimension. Model expects [batch_size, 224, 224, 3].
    #    np.expand_dims(array, axis=0) inserts a new axis at position 0.
    batched = np.expand_dims(array, axis=0)

    return batched


def preprocess_bytes(file_bytes: bytes) -> np.ndarray:
    """Convenience: bytes → ready-for-inference tensor in one call."""
    image = load_image_from_bytes(file_bytes)
    return preprocess_for_inference(image)


def to_storage_jpeg(file_bytes: bytes, max_side: int = 1600, quality: int = 85) -> bytes:
    """Re-encode an upload as an upright, resized JPEG for storage.

    Strips EXIF (which can contain the farmer's GPS position) and keeps
    storage + bandwidth small for farmers on metered data.
    """
    image = load_image_from_bytes(file_bytes)
    if image.mode != "RGB":
        image = image.convert("RGB")
    image.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    out = BytesIO()
    image.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    return out.getvalue()