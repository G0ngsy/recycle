import json
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path(__file__).parent / "fixtures" / "ocr_marks_manifest.json"
ASSET_DIR = BACKEND_DIR / "assets" / "recycle_marks"


def test_ocr_manifest_covers_every_official_asset_once():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    manifest_files = [row["file"] for row in manifest]
    asset_files = sorted(path.name for path in ASSET_DIR.glob("*.jpg"))
    assert len(manifest) == 32
    assert len(manifest_files) == len(set(manifest_files))
    assert sorted(manifest_files) == asset_files


def test_ocr_manifest_has_expected_labels():
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    allowed_categories = {"페트", "플라스틱", "비닐류", "캔류", "종이", "종이팩", "유리", "도포첩합"}
    assert all(row["category"] in allowed_categories for row in manifest)
    assert all("material" in row for row in manifest)
