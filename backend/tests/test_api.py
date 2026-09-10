import base64

from fastapi.testclient import TestClient

from main import app
from routers import recycling

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_regions_returns_all_supported_provinces():
    response = client.get("/api/regions")
    assert response.status_code == 200
    assert len(response.json()["regions"]) == 17
    assert "서울특별시" in response.json()["regions"]


def test_sigungu_rejects_unknown_region():
    response = client.get("/api/regions/없는지역/sigungu")
    assert response.status_code == 404


def test_sigungu_returns_supported_values():
    response = client.get("/api/regions/서울특별시/sigungu")
    assert response.status_code == 200
    assert response.json()["sido"] == "서울특별시"
    assert "종로구" in response.json()["sigungu"]


def test_management_areas_are_required_when_present():
    response = client.get("/api/regions/경기도/sigungu/안성시/areas")
    assert response.status_code == 200
    assert response.json()["required"] is True
    assert "미양면" in response.json()["areas"]


def test_management_areas_are_optional_when_absent():
    response = client.get("/api/regions/서울특별시/sigungu/종로구/areas")
    assert response.status_code == 200
    assert response.json() == {
        "sido": "서울특별시",
        "sigungu": "종로구",
        "areas": [],
        "required": False,
    }


def test_management_area_endpoint_rejects_unknown_sigungu():
    response = client.get("/api/regions/경기도/sigungu/없는시/areas")
    assert response.status_code == 404


def test_guide_rejects_unknown_sigungu():
    response = client.post(
        "/api/recycling-guide",
        json={"itemName": "페트병", "sido": "서울특별시", "sigungu": "없는구"},
    )
    assert response.status_code == 404


def test_guide_rejects_unknown_region():
    response = client.post(
        "/api/recycling-guide",
        json={"itemName": "페트병", "sido": "없는지역", "sigungu": ""},
    )
    assert response.status_code == 404


def test_guide_requires_management_area_when_available():
    response = client.post(
        "/api/recycling-guide",
        json={"itemName": "페트병", "sido": "경기도", "sigungu": "안성시"},
    )
    assert response.status_code == 422


def test_guide_rejects_unknown_management_area():
    response = client.post(
        "/api/recycling-guide",
        json={
            "itemName": "페트병",
            "sido": "경기도",
            "sigungu": "안성시",
            "managementArea": "없는동",
        },
    )
    assert response.status_code == 422


def test_guide_rejects_whitespace_item_name():
    response = client.post(
        "/api/recycling-guide",
        json={"itemName": "   ", "sido": "서울특별시", "sigungu": ""},
    )
    assert response.status_code == 422


def test_cors_does_not_allow_unknown_origin():
    response = client.options(
        "/api/regions",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") is None


def test_guide_returns_structured_fallback_without_external_ai(monkeypatch):
    monkeypatch.setattr(
        recycling,
        "get_recycling_guide",
        lambda item_name, waste_info: {
            "itemName": item_name,
            "category": "플라스틱",
            "isRecyclable": True,
            "disposalSteps": ["내용물을 비운다"],
            "tips": [],
            "source": "공공데이터 기반 지역 배출 정보",
        },
    )
    response = client.post(
        "/api/recycling-guide",
        json={"itemName": "페트병", "sido": "서울특별시", "sigungu": ""},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["itemName"] == "페트병"
    assert body["wasteInfo"]["sigungu"] == ""
    assert len(body["wasteInfo"]["rules"]) == 1


def test_disposal_rules_remove_only_exact_duplicates():
    repeated = {
        "재활용품배출요일": "월",
        "재활용품배출시작시각": "18:00",
        "재활용품배출종료시각": "03:00",
        "배출장소": "지정 장소",
        "재활용품배출방법": "투명 봉투",
    }
    different = {**repeated, "재활용품배출요일": "화"}
    rules = recycling.build_disposal_rules([repeated, repeated.copy(), different])
    assert len(rules) == 2
    assert [rule["disposalDays"] for rule in rules] == ["월", "화"]


def test_guide_returns_all_distinct_rules_for_management_area(monkeypatch):
    monkeypatch.setattr(
        recycling,
        "get_recycling_guide",
        lambda item_name, waste_info: {
            "itemName": item_name,
            "category": "플라스틱",
            "isRecyclable": True,
            "disposalSteps": ["비우기"],
            "tips": [],
            "source": "ignored model source",
        },
    )
    response = client.post(
        "/api/recycling-guide",
        json={
            "itemName": "페트병",
            "sido": "경기도",
            "sigungu": "안성시",
            "managementArea": "미양면",
        },
    )
    assert response.status_code == 200
    waste_info = response.json()["wasteInfo"]
    assert waste_info["managementArea"] == "미양면"
    assert len(waste_info["rules"]) > 1
    assert len({tuple(rule.values()) for rule in waste_info["rules"]}) == len(waste_info["rules"])
    assert "ignored model source" not in response.json()["source"]


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
    response = client.post("/api/analyze-image", json={"image": "dGVzdA=="})
    assert response.status_code == 400


def test_image_rejects_payload_over_limit(monkeypatch):
    monkeypatch.setattr(recycling, "MAX_IMAGE_BYTES", 2)
    encoded = base64.b64encode(b"123").decode()
    response = client.post(
        "/api/analyze-image", json={"image": f"data:image/png;base64,{encoded}"}
    )
    assert response.status_code == 413


def test_image_returns_mark_with_detector_mock(monkeypatch):
    monkeypatch.setattr(
        recycling,
        "_detect_mark",
        lambda image: {"category": "페트", "material": "PET", "texts": ["PET"]},
    )
    encoded = base64.b64encode(b"test-image").decode()
    response = client.post(
        "/api/analyze-image", json={"image": f"data:image/jpeg;base64,{encoded}"}
    )
    assert response.status_code == 200
    assert response.json()["material"] == "PET"
