from services import ai_service


def test_string_false_is_not_treated_as_a_verdict():
    result = ai_service._normalize_guide({"isRecyclable": "false"}, "컵", None)
    assert result["guideStatus"] == "unavailable"
    assert result["isRecyclable"] is None


def test_invalid_step_objects_are_replaced_with_safe_steps():
    result = ai_service._normalize_guide({"isRecyclable": True, "disposalSteps": [{"invalid": True}]}, "컵", None)
    assert result["disposalSteps"] == []


def test_invalid_ai_json_returns_safe_fallback(monkeypatch):
    monkeypatch.setattr(ai_service, "_get_response", lambda prompt: "not-json")
    result = ai_service.get_recycling_guide("페트병", None)
    assert result["isRecyclable"] is None
    assert result["guideStatus"] == "unavailable"
    assert result["source"] == "분리수거 AI 기본 안내"


def test_provider_failure_does_not_expose_exception(monkeypatch):
    def fail(prompt):
        raise RuntimeError("secret provider detail")

    monkeypatch.setattr(ai_service, "_get_response", fail)
    result = ai_service.get_recycling_guide("페트병", {"시도명": "서울특별시", "시군구명": "종로구"})
    assert "secret provider detail" not in str(result)
    assert result["source"] == "공공데이터 기반 지역 배출 정보 (서울특별시 종로구)"


def test_model_generated_source_is_replaced(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "_get_response",
        lambda prompt: '{"itemName":"페트병","category":"플라스틱","isRecyclable":true,'
        '"disposalSteps":["비우기"],"tips":[],"source":"invented.example"}',
    )
    result = ai_service.get_recycling_guide("페트병", None)
    assert result["source"] == "분리수거 AI 기본 안내"
