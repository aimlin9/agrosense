"""TensorFlow Lite inference service.

Loads the trained MobileNetV2 model once at server startup and exposes a
`predict()` function that returns the top-k predicted classes for an image.

Singleton design: the interpreter is created once and reused across requests.
Loading is ~70ms; inference is ~30ms. We don't want to repeat loading per request.
"""

import json
import logging
import threading
from pathlib import Path
from typing import Any, TypedDict

import numpy as np

logger = logging.getLogger("agrosense.ml")


def _interpreter_class() -> Any:
    """Prefer the lightweight LiteRT / tflite-runtime packages (≈10× less RAM
    than full TensorFlow) and fall back to TensorFlow when they're absent."""
    try:
        from ai_edge_litert.interpreter import Interpreter  # type: ignore
        return Interpreter
    except ImportError:
        pass
    try:
        from tflite_runtime.interpreter import Interpreter  # type: ignore
        return Interpreter
    except ImportError:
        pass
    import tensorflow as tf  # heavy; last resort
    return tf.lite.Interpreter


# ─── File paths ──────────────────────────────────────────────
# backend/ml/crop_disease_model.tflite was exported from Week 1's Colab notebook.
ML_DIR = Path(__file__).parent.parent.parent / "ml"
MODEL_PATH = ML_DIR / "crop_disease_model.tflite"
CLASS_NAMES_PATH = ML_DIR / "class_names.json"


class Prediction(TypedDict):
    """One prediction in the top-k list."""
    class_index: int
    class_name: str
    confidence: float


# ─── Singleton state (module-level) ──────────────────────────
# These get populated by load_model() at server startup.
_interpreter: Any = None
# TFLite interpreters are not thread-safe; inference runs in worker threads.
_lock = threading.Lock()
_input_details: list | None = None
_output_details: list | None = None
_class_names: list[str] | None = None


def load_model() -> None:
    """Load the TFLite model and class names into memory.
    
    Called once at FastAPI startup via the lifespan event. Subsequent calls
    are no-ops, so it's safe to call defensively.
    """
    global _interpreter, _input_details, _output_details, _class_names

    if _interpreter is not None:
        # Already loaded — nothing to do
        return

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"TFLite model not found at {MODEL_PATH}. "
            f"Make sure crop_disease_model.tflite is in backend/ml/"
        )

    if not CLASS_NAMES_PATH.exists():
        raise FileNotFoundError(
            f"Class names file not found at {CLASS_NAMES_PATH}. "
            f"Make sure class_names.json is in backend/ml/"
        )

    # Load class names list — index N in this list = output index N from the model
    with open(CLASS_NAMES_PATH, "r", encoding="utf-8") as f:
        _class_names = json.load(f)

    # Build the interpreter
    _interpreter = _interpreter_class()(model_path=str(MODEL_PATH))
    _interpreter.allocate_tensors()

    # Cache input/output tensor metadata. We need the index of each tensor
    # to feed inputs and read outputs.
    _input_details = _interpreter.get_input_details()
    _output_details = _interpreter.get_output_details()

    logger.info(
        "Model loaded: %d classes, input %s, output %s",
        len(_class_names), _input_details[0]["shape"], _output_details[0]["shape"],
    )


def is_loaded() -> bool:
    return _interpreter is not None


def predict(input_tensor: np.ndarray, top_k: int = 3) -> list[Prediction]:
    """Run inference and return the top-k predictions.
    
    Args:
        input_tensor: a numpy array of shape [1, 224, 224, 3], float32.
                      Use image_service.preprocess_bytes() to produce this.
        top_k: how many top predictions to return (default 3).
    
    Returns:
        List of Prediction dicts, sorted by confidence descending.
        Example:
            [
                {"class_index": 27, "class_name": "Tomato___Late_blight", "confidence": 0.94},
                {"class_index": 26, "class_name": "Tomato___Early_blight", "confidence": 0.04},
                {"class_index": 31, "class_name": "Tomato___Target_Spot", "confidence": 0.01},
            ]
    """
    if _interpreter is None:
        raise RuntimeError(
            "Model not loaded. Call load_model() at startup before predict()."
        )

    # 1. Validate input shape
    expected_shape = tuple(_input_details[0]["shape"])
    if input_tensor.shape != expected_shape:
        raise ValueError(
            f"Input tensor has shape {input_tensor.shape}, "
            f"expected {expected_shape}"
        )

    # 2. Set input tensor and invoke inference
    with _lock:
        _interpreter.set_tensor(_input_details[0]["index"], input_tensor.astype(np.float32))
        _interpreter.invoke()
        # 3. Read output. Shape is [1, 38] — one row of 38 class probabilities.
        output = _interpreter.get_tensor(_output_details[0]["index"]).copy()
    probabilities = output[0]  # drop the batch dimension → [38]

    # 4. Get top-k indices, descending order
    top_indices = np.argsort(probabilities)[::-1][:top_k]

    # 5. Build the result list
    results: list[Prediction] = []
    for idx in top_indices:
        results.append({
            "class_index": int(idx),
            "class_name": _class_names[int(idx)],
            "confidence": float(probabilities[int(idx)]),
        })

    return results