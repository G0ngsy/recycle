import os
import json
import logging

logger = logging.getLogger(__name__)


def _source_label(waste_info: dict | None) -> str:
    if not waste_info:
        return "분리수거 AI 기본 안내"
    region = " ".join(
        part for part in (waste_info.get("시도명", ""), waste_info.get("시군구명", "")) if part
    )
    return f"공공데이터 기반 지역 배출 정보 ({region or '지역 미상'})"


def _fallback_guide(item_name: str, waste_info: dict | None, reason: str = "") -> dict:
    return {
        "itemName": item_name or "알 수 없음",
        "category": "확인 필요",
        "isRecyclable": False,
        "disposalSteps": [
            "품목의 재질 표시와 오염 여부를 먼저 확인하세요.",
            "내용물을 비우고 가능한 경우 깨끗하게 헹구세요.",
            "지역 배출 정보에 맞춰 지정된 장소에 배출하세요.",
        ],
        "tips": [
            "오염이 심하거나 재질이 불명확하면 일반쓰레기 또는 지자체 안내를 확인하세요.",
        ],
        "source": _source_label(waste_info),
    }


def _normalize_guide(result: dict, item_name: str, waste_info: dict | None) -> dict:
    fallback = _fallback_guide(item_name, waste_info)
    if not isinstance(result, dict):
        return fallback

    normalized = {**fallback, **result}
    normalized["itemName"] = str(normalized.get("itemName") or item_name or "알 수 없음")
    normalized["category"] = str(normalized.get("category") or fallback["category"])
    recyclable = normalized.get("isRecyclable")
    if isinstance(recyclable, str) and recyclable.lower() in {"true", "false"}:
        recyclable = recyclable.lower() == "true"
    if not isinstance(recyclable, bool):
        return fallback
    normalized["isRecyclable"] = recyclable

    for key in ("disposalSteps", "tips"):
        value = normalized.get(key)
        if isinstance(value, str):
            normalized[key] = [value]
        elif not isinstance(value, list) or not all(isinstance(entry, str) for entry in value):
            normalized[key] = fallback[key]

    # Source is application-owned metadata; never trust a model-generated citation.
    normalized["source"] = _source_label(waste_info)
    return normalized


def _get_response(prompt: str) -> str:
    use_ollama = os.getenv("USE_OLLAMA", "true").lower() == "true"
    timeout = float(os.getenv("AI_TIMEOUT_SECONDS", "20"))

    if use_ollama:
        import ollama

        model = os.getenv("OLLAMA_MODEL", "exaone3.5")
        client = ollama.Client(timeout=timeout)
        response = client.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response["message"]["content"]
    else:
        from huggingface_hub import InferenceClient

        token = os.getenv("HF_API_TOKEN")
        if not token:
            raise RuntimeError("HF_API_TOKEN is required when USE_OLLAMA=false")
        model = os.getenv("HF_MODEL", "LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct")
        client = InferenceClient(token=token, timeout=timeout)
        response = client.chat_completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
        )
        return response.choices[0].message.content


def analyze_image_item(base64_image: str) -> str:
    """OCR(재활용 마크) 메인 + YOLO 보조 → EXAONE 품목명 추론"""
    from services.image_service import detect_objects, detect_recycle_mark

    # 1. 재활용 마크 OCR (메인)
    mark = detect_recycle_mark(base64_image)
    # 2. YOLO 물체 감지 (보조)
    yolo_labels = detect_objects(base64_image)

    print(f"[DEBUG] 재활용마크: {mark}, YOLO: {yolo_labels}")

    # 마크에서 재질을 바로 확인한 경우 → EXAONE으로 품목명 확정
    category_str = mark.get("category") or "없음"
    material_str = mark.get("material") or "없음"
    ocr_str = ", ".join(mark["texts"][:8]) if mark["texts"] else "없음"
    yolo_str = ", ".join(yolo_labels) if yolo_labels else "없음"

    prompt = f"""다음은 분리배출 마크 이미지 분석 결과입니다.
- 대분류: {category_str}
- 세부재질: {material_str}
- OCR 텍스트: {ocr_str}
- 물체형태(YOLO): {yolo_str}

위 정보를 바탕으로 분리수거 품목명을 한국어로 한 단어만 답하세요.
예: 페트병, 알루미늄캔, 철캔, 유리병, 비닐봉지, 종이박스, 플라스틱용기, 종이팩, 멸균팩"""

    result = _get_response(prompt).strip()
    first_line = result.split("\n")[0].strip()
    if len(first_line) <= 15:
        return first_line
    return first_line.split()[0].rstrip(".,。")


def get_recycling_guide(item_name: str, waste_info: dict | None, graph_context: str = "") -> dict:
    """품목 + 지역 배출정보 + 그래프 컨텍스트 기반 분리수거 가이드 생성"""
    region_context = ""
    if waste_info:
        region_context = f"""
지역 배출 정보 ({waste_info.get('시도명', '')} {waste_info.get('시군구명', '')}):
- 재활용품 배출방법: {waste_info.get('재활용품배출방법', '')}
- 재활용품 배출요일: {waste_info.get('재활용품배출요일', '')}
- 재활용품 배출시각: {waste_info.get('재활용품배출시작시각', '')} ~ {waste_info.get('재활용품배출종료시각', '')}
- 배출장소: {waste_info.get('배출장소', '')}
"""

    graph_section = f"\n[지식 그래프 컨텍스트]\n{graph_context}\n" if graph_context else ""

    prompt = f"""당신은 한국의 분리수거 전문가입니다.
품목: "{item_name}"
{region_context}{graph_section}
위 품목의 올바른 분리수거 방법을 아래 JSON 형식으로만 답해주세요.
다른 텍스트 없이 JSON만 출력하세요.

{{
  "itemName": "품목명",
  "category": "분류 (플라스틱/종이/유리/금속/일반쓰레기/음식물/특수폐기물 중 하나)",
  "isRecyclable": true 또는 false,
  "disposalSteps": ["배출 단계 1", "배출 단계 2", "배출 단계 3"],
  "tips": ["주의사항 1", "주의사항 2"]
}}"""

    try:
        raw = _get_response(prompt)
    except Exception as error:
        logger.warning("AI provider call failed: %s", type(error).__name__)
        return _fallback_guide(item_name, waste_info, "AI 호출 실패")

    logger.debug("AI response received (%d characters)", len(raw))
    # JSON 블록 추출
    cleaned = raw.strip()
    if "```" in cleaned:
        parts = cleaned.split("```")
        for part in parts:
            part = part.strip().lstrip("json").strip()
            if part.startswith("{"):
                cleaned = part
                break
    # 중괄호 범위만 추출
    start = cleaned.find("{")
    end = cleaned.rfind("}") + 1
    if start != -1 and end > start:
        cleaned = cleaned[start:end]
    try:
        result = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("AI response was not valid JSON")
        return _fallback_guide(item_name, waste_info, "AI JSON 파싱 실패")

    # 최상위가 list면 첫 번째 요소 사용
    if isinstance(result, list):
        result = result[0] if result else {}
    return _normalize_guide(result, item_name, waste_info)
