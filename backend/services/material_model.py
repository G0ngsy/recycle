import base64
import io
import json
import logging
import math
import os
from pathlib import Path
from threading import Lock

from PIL import Image, ImageOps, ImageStat

CLASSES = ("cardboard", "glass", "metal", "paper", "plastic", "trash")
LABELS = ("골판지", "유리", "금속", "종이", "플라스틱", "기타")
PREPROCESS = {"size": 224, "resize": 256, "mean": [0.485, 0.456, 0.406], "std": [0.229, 0.224, 0.225]}
MODEL_DIR = Path(__file__).resolve().parents[1] / "models" / "trashnet-reviewed-v2"
logger = logging.getLogger(__name__)
_lock = Lock()
_loaded = None
_loaded_path = None


def decode_photo(payload: str) -> Image.Image:
    try:
        data = base64.b64decode(payload.split(",", 1)[1], validate=True)
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in {"JPEG", "PNG"} or image.width * image.height > 40_000_000:
                raise ValueError("Unsupported image")
            image.load()
            return ImageOps.exif_transpose(image).convert("RGB")
    except Exception as error:
        raise ValueError("이미지를 처리할 수 없습니다.") from error


def evaluation_transform():
    from torchvision import transforms

    return transforms.Compose([
        transforms.Resize(PREPROCESS["resize"]),
        transforms.CenterCrop(PREPROCESS["size"]),
        transforms.ToTensor(),
        transforms.Normalize(PREPROCESS["mean"], PREPROCESS["std"]),
    ])


def build_model(pretrained: bool = False):
    from torch import nn
    from torchvision.models import MobileNet_V3_Small_Weights, mobilenet_v3_small

    model = mobilenet_v3_small(weights=MobileNet_V3_Small_Weights.DEFAULT if pretrained else None)
    model.classifier[-1] = nn.Linear(model.classifier[-1].in_features, len(CLASSES))
    return model


def _load_model():
    global _loaded, _loaded_path
    model_dir = Path(os.getenv("MATERIAL_MODEL_DIR") or MODEL_DIR).resolve()
    with _lock:
        if _loaded is not None and _loaded_path == model_dir:
            return _loaded
        if not (model_dir / "model.pt").is_file() or not (model_dir / "metadata.json").is_file():
            return None
        import torch

        metadata = json.loads((model_dir / "metadata.json").read_text(encoding="utf-8"))
        if metadata.get("classes") != list(CLASSES) or metadata.get("preprocess") != PREPROCESS:
            raise ValueError("Model metadata is incompatible")
        thresholds = metadata["thresholds"]
        if set(thresholds) != set(CLASSES) or any(
            value is not None and (not isinstance(value, (int, float)) or not math.isfinite(value) or not 0 <= value <= 1)
            for value in thresholds.values()
        ):
            raise ValueError("Invalid thresholds")
        model = build_model()
        model.load_state_dict(torch.load(model_dir / "model.pt", map_location="cpu", weights_only=True))
        model.eval()
        _loaded = model, evaluation_transform(), metadata
        _loaded_path = model_dir
        return _loaded


def classify_photo(image: Image.Image) -> dict:
    try:
        # Only rejects almost uniform frames; this is not general object/OOD detection.
        if max(ImageStat.Stat(image.resize((64, 64))).stddev) < 2:
            return {"status": "unavailable", "reason": "low_information", "candidates": [], "needsConfirmation": True}
        loaded = _load_model()
        if loaded is None:
            return {"status": "unavailable", "candidates": [], "needsConfirmation": True}
        import torch

        model, transform, metadata = loaded
        with torch.inference_mode():
            scores = model(transform(image).unsqueeze(0)).softmax(dim=1)[0].tolist()
        if not all(math.isfinite(score) for score in scores):
            raise ValueError("Non-finite prediction")
        order = sorted(range(len(scores)), key=lambda index: scores[index], reverse=True)
        best = order[0]
        threshold = metadata["thresholds"][CLASSES[best]]
        return {
            "status": "ready", "modelVersion": metadata["version"], "experimental": True,
            "candidates": [
                {"className": CLASSES[index], "label": LABELS[index], "score": scores[index]}
                for index in order[:3]
            ],
            "needsConfirmation": CLASSES[best] == "trash" or threshold is None or scores[best] < threshold,
        }
    except Exception:
        logger.exception("Material classification failed")
        return {"status": "error", "candidates": [], "needsConfirmation": True}


def has_material_conflict(category: str | None, prediction: dict) -> bool:
    families = {"페트": "plastic", "플라스틱": "plastic", "비닐류": "plastic", "캔류": "metal", "종이": "paper", "유리": "glass"}
    candidates = prediction.get("candidates", [])
    if category not in families or not candidates:
        return False
    predicted = candidates[0]["className"]
    return predicted != "trash" and predicted != families[category] and not (
        category == "종이" and predicted == "cardboard"
    )
