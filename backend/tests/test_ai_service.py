import sys
from types import SimpleNamespace

import pytest

from services import ai_service


def test_string_false_is_not_treated_as_a_verdict():
    result = ai_service._normalize_guide({"isRecyclable": "false"}, "컵", None)
    assert result["guideStatus"] == "unavailable"
    assert result["isRecyclable"] is None


def test_model_cannot_replace_the_user_confirmed_item():
    result = ai_service._normalize_guide({"itemName": "종이컵", "isRecyclable": True}, "유리병", None)
    assert result["itemName"] == "유리병"


def test_invalid_step_objects_are_replaced_with_safe_steps():
    result = ai_service._normalize_guide({"isRecyclable": True, "disposalSteps": [{"invalid": True}]}, "컵", None)
    assert result["disposalSteps"] == []


def test_invalid_ai_json_returns_safe_fallback(monkeypatch):
    monkeypatch.setattr(ai_service, "_get_response", lambda prompt, **kwargs: "not-json")
    result = ai_service.get_recycling_guide("페트병", None)
    assert result["isRecyclable"] is None
    assert result["guideStatus"] == "unavailable"
    assert result["source"] == "분리수거 AI 기본 안내"


def test_local_guide_request_is_bounded_and_uses_json(monkeypatch):
    requests = []
    class FakeClient:
        def __init__(self, **kwargs):
            assert kwargs["timeout"] == 60

        def chat(self, **kwargs):
            requests.append(kwargs)
            return {"message": {"content": '{"isRecyclable":true}'}, "done_reason": "stop"}

    monkeypatch.setenv("USE_OLLAMA", "true")
    monkeypatch.delenv("AI_TIMEOUT_SECONDS", raising=False)
    monkeypatch.setitem(sys.modules, "ollama", SimpleNamespace(Client=FakeClient))
    assert ai_service.get_recycling_guide("유리병", None)["guideStatus"] == "ready"
    assert requests[0]["format"] == "json"
    assert requests[0]["options"]["num_predict"] == 512
    assert requests[0]["options"]["num_ctx"] == 4096
    ai_service._get_response("품목명만 답하세요")
    assert requests[1]["format"] is None


def test_truncated_json_is_not_accepted_as_complete_guide(monkeypatch):
    class FakeClient:
        def __init__(self, **kwargs):
            pass

        def chat(self, **kwargs):
            return {"message": {"content": '{"isRecyclable":true}'}, "done_reason": "length"}

    monkeypatch.setenv("USE_OLLAMA", "true")
    monkeypatch.setitem(sys.modules, "ollama", SimpleNamespace(Client=FakeClient))
    assert ai_service.get_recycling_guide("유리병", None)["guideStatus"] == "unavailable"
    with pytest.raises(RuntimeError, match="output limit"):
        ai_service._get_response("JSON 안내", json_response=True)


def test_provider_failure_does_not_expose_exception(monkeypatch):
    def fail(prompt, **kwargs):
        raise RuntimeError("secret provider detail")

    monkeypatch.setattr(ai_service, "_get_response", fail)
    result = ai_service.get_recycling_guide("페트병", {"시도명": "서울특별시", "시군구명": "종로구"})
    assert "secret provider detail" not in str(result)
    assert result["source"] == "공공데이터 기반 지역 배출 정보 (서울특별시 종로구)"


def test_model_generated_source_is_replaced(monkeypatch):
    monkeypatch.setattr(
        ai_service,
        "_get_response",
        lambda prompt, **kwargs: '{"itemName":"페트병","category":"플라스틱","isRecyclable":true,'
        '"disposalSteps":["비우기"],"tips":[],"source":"invented.example"}',
    )
    result = ai_service.get_recycling_guide("페트병", None)
    assert result["source"] == "분리수거 AI 기본 안내"
