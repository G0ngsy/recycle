import base64
import importlib.util
import json
import os
import time
from pathlib import Path

import pytest

pytestmark = pytest.mark.ocr

BACKEND_DIR = Path(__file__).resolve().parents[2]
ASSET_DIR = BACKEND_DIR / "assets" / "recycle_marks"
MANIFEST_PATH = Path(__file__).resolve().parents[1] / "fixtures" / "ocr_marks_manifest.json"
REPORT_PATH = BACKEND_DIR / "test-results" / "ocr-baseline.json"


def _require_ocr_runtime():
    if os.getenv("RUN_OCR_INTEGRATION") != "1":
        pytest.skip("Set RUN_OCR_INTEGRATION=1 to run the real OCR baseline.")
    missing = [name for name in ("cv2", "easyocr", "numpy") if importlib.util.find_spec(name) is None]
    if missing:
        pytest.skip(f"OCR runtime dependencies are not installed: {', '.join(missing)}")
    model_dir = Path(os.getenv("EASYOCR_MODEL_DIR") or Path.home() / ".EasyOCR" / "model")
    required_models = {"craft_mlt_25k.pth", "korean_g2.pth"}
    available_models = {path.name for path in model_dir.glob("*.pth")} if model_dir.exists() else set()
    missing_models = sorted(required_models - available_models)
    if missing_models:
        pytest.skip(f"Pre-provisioned EasyOCR models are missing at {model_dir}: {', '.join(missing_models)}")
    os.environ["EASYOCR_MODEL_DIR"] = str(model_dir)
    os.environ["EASYOCR_DOWNLOAD_ENABLED"] = "false"


def _as_data_url(image) -> str:
    import cv2

    ok, encoded = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 90])
    assert ok
    return "data:image/jpeg;base64," + base64.b64encode(encoded).decode()


def _variants(image):
    import cv2

    height, width = image.shape[:2]
    rotation = cv2.getRotationMatrix2D((width / 2, height / 2), 5, 1)
    yield "original", image
    yield "rotate_5deg", cv2.warpAffine(image, rotation, (width, height), borderValue=(255, 255, 255))
    yield "dim", cv2.convertScaleAbs(image, alpha=0.65, beta=0)
    yield "scaled_60pct", cv2.resize(image, None, fx=0.6, fy=0.6, interpolation=cv2.INTER_AREA)
    yield "blur_3px", cv2.GaussianBlur(image, (3, 3), 0)


def test_official_recycle_mark_baseline():
    _require_ocr_runtime()
    import cv2
    import numpy as np
    from services.image_service import detect_recycle_mark, preprocess_image

    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    assert len(manifest) == 32
    results = []

    for expected in manifest:
        image = cv2.imdecode(np.frombuffer((ASSET_DIR / expected["file"]).read_bytes(), dtype=np.uint8), cv2.IMREAD_COLOR)
        assert image is not None, f"Missing fixture: {expected['file']}"
        for variant_name, variant in _variants(image):
            started = time.perf_counter()
            detected = detect_recycle_mark(preprocess_image(_as_data_url(variant)))
            elapsed_ms = round((time.perf_counter() - started) * 1000, 1)
            results.append(
                {
                    "file": expected["file"],
                    "variant": variant_name,
                    "expected": {"category": expected["category"], "material": expected["material"]},
                    "actual": detected,
                    "categoryMatch": detected.get("category") == expected["category"],
                    "materialMatch": detected.get("material") == expected["material"],
                    "elapsedMs": elapsed_ms,
                }
            )

    originals = [row for row in results if row["variant"] == "original"]
    category_accuracy = sum(row["categoryMatch"] for row in originals) / len(originals)
    material_accuracy = sum(row["materialMatch"] for row in originals) / len(originals)
    report = {
        "fixtureCount": len(manifest),
        "variantCount": len(results),
        "categoryAccuracy": round(category_accuracy, 4),
        "materialAccuracy": round(material_accuracy, 4),
        "averageOriginalElapsedMs": round(sum(row["elapsedMs"] for row in originals) / len(originals), 1),
        "releaseThresholds": {"categoryAccuracy": 0.9, "materialAccuracy": 0.8},
        "results": results,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    if os.getenv("OCR_ENFORCE_THRESHOLDS") == "1":
        assert category_accuracy >= 0.9
        assert material_accuracy >= 0.8
