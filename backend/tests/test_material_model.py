import base64
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from main import app
from routers import recycling
from services import material_model
from services.material_model import CLASSES, decode_photo, has_material_conflict
from services.trashnet_data import classification_metrics, prepare_dataset, select_thresholds


def photo_payload():
    buffer = BytesIO()
    Image.new("RGB", (16, 16), "white").save(buffer, "PNG")
    return "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode()


def prediction(class_name="glass", score=0.8):
    return {"status": "ready", "candidates": [{"className": class_name, "label": "유리", "score": score}], "needsConfirmation": False}


def textured_photo():
    image = Image.new("RGB", (256, 256), "white")
    image.paste("black", (0, 0, 128, 256))
    return image


def test_decode_photo_rejects_fake_image():
    with pytest.raises(ValueError):
        decode_photo("data:image/png;base64,dGVzdA==")


def test_missing_model_falls_back(monkeypatch, tmp_path):
    monkeypatch.setenv("MATERIAL_MODEL_DIR", str(tmp_path))
    assert material_model.classify_photo(textured_photo())["status"] == "unavailable"


def test_model_failure_falls_back(monkeypatch):
    def fail():
        raise RuntimeError("broken checkpoint")
    monkeypatch.setattr(material_model, "_load_model", fail)
    assert material_model.classify_photo(textured_photo())["status"] == "error"


@pytest.mark.parametrize("class_name,threshold,expected", [("glass", 0.7, False), ("glass", 0.95, True), ("glass", None, True), ("trash", 0.1, True)])
def test_prediction_confirmation_policy(monkeypatch, class_name, threshold, expected):
    torch = pytest.importorskip("torch")
    logits = torch.zeros((1, len(CLASSES)))
    logits[0, CLASSES.index(class_name)] = 4
    metadata = {"version": "test", "thresholds": {name: threshold for name in CLASSES}}
    monkeypatch.setattr(material_model, "_load_model", lambda: (lambda image: logits, lambda image: torch.zeros(3, 224, 224), metadata))
    result = material_model.classify_photo(textured_photo())
    assert result["status"] == "ready"
    assert result["needsConfirmation"] is expected
    assert len(result["candidates"]) == 3


def test_checkpoint_load_is_offline_and_cached(monkeypatch, tmp_path):
    import json
    torch = pytest.importorskip("torch")
    monkeypatch.setenv("MATERIAL_MODEL_DIR", str(tmp_path))
    monkeypatch.setattr(material_model, "_loaded", None)
    monkeypatch.setattr(material_model, "_loaded_path", None)
    model = material_model.build_model()
    torch.save(model.state_dict(), tmp_path / "model.pt")
    metadata = {"version": "test", "classes": list(CLASSES), "preprocess": material_model.PREPROCESS, "thresholds": {name: None for name in CLASSES}}
    (tmp_path / "metadata.json").write_text(json.dumps(metadata), encoding="utf-8")
    first = material_model._load_model()
    assert material_model._load_model() is first
    result = material_model.classify_photo(textured_photo())
    assert result["status"] == "ready"
    assert result["needsConfirmation"] is True


@pytest.mark.parametrize("color", ["white", "black", "gray", "green"])
def test_uniform_frames_do_not_produce_material_candidates(monkeypatch, color):
    def unexpected():
        pytest.fail("Uniform frames must be rejected before model inference")
    monkeypatch.setattr(material_model, "_load_model", unexpected)
    result = material_model.classify_photo(Image.new("RGB", (512, 512), color))
    assert result["reason"] == "low_information"
    assert result["candidates"] == []
    assert result["needsConfirmation"] is True


def test_conflict_and_paper_family():
    assert has_material_conflict("페트", prediction())
    assert not has_material_conflict("유리", prediction())
    assert not has_material_conflict("종이", prediction("cardboard"))
    assert not has_material_conflict("유리", prediction("trash"))
    assert not has_material_conflict("종이팩", prediction())


def test_ocr_failure_keeps_prediction(monkeypatch):
    monkeypatch.setattr(recycling, "classify_photo", lambda photo: prediction())
    def fail(image):
        raise RuntimeError("OCR unavailable")
    monkeypatch.setattr(recycling, "_detect_mark", fail)
    response = TestClient(app).post("/api/analyze-image", json={"image": photo_payload()})
    assert response.status_code == 200
    assert response.json()["ocrStatus"] == "error"
    assert response.json()["materialPrediction"]["candidates"][0]["className"] == "glass"


def test_api_keeps_ocr_when_model_unavailable(monkeypatch):
    monkeypatch.setattr(recycling, "classify_photo", lambda photo: {"status": "error", "candidates": [], "needsConfirmation": True})
    monkeypatch.setattr(recycling, "_detect_mark", lambda image: {"category": "유리", "material": None, "texts": ["유리"]})
    response = TestClient(app).post("/api/analyze-image", json={"image": photo_payload()})
    assert response.json()["category"] == "유리"
    assert response.json()["materialPrediction"]["status"] == "error"


def test_api_reports_conflict(monkeypatch):
    monkeypatch.setattr(recycling, "classify_photo", lambda photo: prediction())
    monkeypatch.setattr(recycling, "_detect_mark", lambda image: {"category": "페트", "material": "PET", "texts": ["PET"]})
    response = TestClient(app).post("/api/analyze-image", json={"image": photo_payload()})
    assert response.json()["materialConflict"] is True


def test_invalid_image_returns_400_before_running_models(monkeypatch):
    def unexpected(photo):
        pytest.fail("Classifier must not run")
    monkeypatch.setattr(recycling, "classify_photo", unexpected)
    assert TestClient(app).post("/api/analyze-image", json={"image": "data:image/png;base64,dGVzdA=="}).status_code == 400


def test_split_is_reproducible_and_duplicates_do_not_leak(tmp_path):
    source = tmp_path / "source"
    for class_index, class_name in enumerate(CLASSES):
        folder = source / class_name
        folder.mkdir(parents=True)
        for index in range(10):
            Image.new("RGB", (8, 8), (class_index * 30, index * 20, 50)).save(folder / f"{index}.png")
    (source / "glass" / "duplicate.png").write_bytes((source / "glass" / "0.png").read_bytes())
    (source / "metal" / "wrong-label.png").write_bytes((source / "paper" / "0.png").read_bytes())
    (source / "trash" / "broken.jpg").write_bytes(b"broken")
    first = prepare_dataset(source, tmp_path / "first")
    second = prepare_dataset(source, tmp_path / "second")
    assert first["records"] == second["records"]
    assert len({row["sha256"] for row in first["records"]}) == len(first["records"])
    assert len(first["duplicates"]) == 1
    assert len(first["conflictingDuplicates"]) == 1
    assert len(first["invalid"]) == 1
    assert first["counts"]["train"]["glass"] == 7
    with pytest.raises(ValueError):
        prepare_dataset(source, tmp_path / "first")


def test_threshold_requires_precision_and_minimum_support():
    targets = [1] * 10 + [0] * 2
    scores = [[0.05, 0.9, 0.01, 0.01, 0.02, 0.01] for _ in range(10)] + [[0.1, 0.8, 0.02, 0.03, 0.03, 0.02] for _ in range(2)]
    thresholds = select_thresholds(targets, scores)
    assert thresholds["glass"] == 0.9
    assert thresholds["metal"] is None
    assert select_thresholds([1], [scores[0]])["glass"] is None


def test_reviewed_variants_keep_one_representative_and_reject_stale_review(tmp_path):
    import hashlib
    import json
    source = tmp_path / "source"
    for class_index, name in enumerate(CLASSES):
        folder = source / name
        folder.mkdir(parents=True)
        for index in range(10):
            Image.new("RGB", (8, 8), (class_index * 30, index * 20, 50)).save(folder / f"{index}.png")
    files = ["paper/0.png", "paper/1.png"]
    hashes = []
    for path in files:
        with Image.open(source / path) as image:
            hashes.append(hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest())
    review = tmp_path / "review.json"
    group = {"files": files, "sha256": hashes}
    review.write_text(json.dumps({"groups": [group]}), encoding="utf-8")
    result = prepare_dataset(source, tmp_path / "prepared", reviewed_groups=review)
    assert len(result["records"]) == 59
    assert result["reviewedNearDuplicateGroups"] == [group]
    assert len(result["duplicates"]) == 1
    assert sum(row["path"].endswith("paper/0.png") or row["path"].endswith("paper/1.png") for row in result["records"]) == 1
    Image.new("RGB", (8, 8), "black").save(source / "paper/1.png")
    with pytest.raises(ValueError, match="changed"):
        prepare_dataset(source, tmp_path / "stale", reviewed_groups=review)


def test_metrics_capture_confused_materials():
    metrics = classification_metrics([1, 1, 4], [1, 4, 1])
    assert metrics["accuracy"] == pytest.approx(1 / 3)
    assert metrics["confusionMatrix"][1][4] == 1
    assert metrics["perClass"]["glass"]["recall"] == 0.5
