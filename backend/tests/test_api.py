import base64

from fastapi.testclient import TestClient

from main import app
from routers import recycling
from services.waste_data import dataset

client = TestClient(app)


def single_record_region():
    return next(key for key, rows in dataset()[1].items() if len(rows) == 1)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_regions_use_waste_csv_names():
    response = client.get("/api/regions")
    assert response.status_code == 200
    assert len(response.json()["regions"]) == 16
    assert "전남광주통합특별시" in response.json()["regions"]


def test_sigungu_rejects_unknown_region():
    assert client.get("/api/regions/없는지역/sigungu").status_code == 404


def test_sigungu_accepts_legacy_region_name():
    response = client.get("/api/regions/전라남도/sigungu")
    assert response.status_code == 200
    assert response.json()["sido"] == "전남광주통합특별시"


def test_guide_rejects_unknown_sigungu():
    response = client.post("/api/recycling-guide", json={
        "itemName": "페트병", "sido": "서울특별시", "sigungu": "없는구",
    })
    assert response.status_code == 404


def test_guide_rejects_whitespace_item_name():
    key = single_record_region()
    response = client.post("/api/recycling-guide", json={
        "itemName": "   ", "sido": key[0], "sigungu": key[1],
    })
    assert response.status_code == 422


def test_cors_does_not_allow_unknown_origin():
    response = client.options(
        "/api/regions",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") is None


def test_guide_returns_selected_record_and_owned_source(monkeypatch):
    monkeypatch.setattr(recycling, "get_recycling_guide", lambda item_name, waste_info: {
        "itemName": item_name,
        "category": "플라스틱",
        "guideStatus": "ready",
        "isRecyclable": True,
        "disposalSteps": ["내용물을 비운다"],
        "tips": [],
        "source": "invented.example",
    })
    key = single_record_region()
    response = client.post("/api/recycling-guide", json={
        "itemName": "페트병", "sido": key[0], "sigungu": key[1],
    })
    assert response.status_code == 200
    body = response.json()
    assert body["wasteInfo"]["관리번호"] == dataset()[1][key][0]["관리번호"]
    assert body["source"] == "AI 생성 안내"


def test_image_rejects_unsupported_mime_type():
    response = client.post(
        "/api/analyze-image",
        json={"image": "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA=="},
    )
    assert response.status_code == 400


def test_image_rejects_invalid_base64():
    response = client.post(
        "/api/analyze-image",
        json={"image": "data:image/jpeg;base64,not-valid***"},
    )
    assert response.status_code == 400


def test_image_rejects_raw_base64_without_mime():
    assert client.post("/api/analyze-image", json={"image": "dGVzdA=="}).status_code == 400


def test_image_rejects_payload_over_limit(monkeypatch):
    monkeypatch.setattr(recycling, "MAX_IMAGE_BYTES", 2)
    encoded = base64.b64encode(b"123").decode()
    response = client.post(
        "/api/analyze-image", json={"image": f"data:image/png;base64,{encoded}"},
    )
    assert response.status_code == 413


def test_image_returns_mark_with_detector_mock(monkeypatch):
    monkeypatch.setattr(recycling, "_detect_mark", lambda image: {
        "category": "페트", "material": "PET", "texts": ["PET"],
    })
    encoded = base64.b64encode(b"test-image").decode()
    response = client.post(
        "/api/analyze-image", json={"image": f"data:image/jpeg;base64,{encoded}"},
    )
    assert response.status_code == 200
    assert response.json()["material"] == "PET"
