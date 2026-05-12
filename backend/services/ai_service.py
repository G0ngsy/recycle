import os
import json
import ollama
from huggingface_hub import InferenceClient


def _get_response(prompt: str) -> str:
    use_ollama = os.getenv("USE_OLLAMA", "true").lower() == "true"

    if use_ollama:
        model = os.getenv("OLLAMA_MODEL", "exaone3.5")
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
        )
        return response["message"]["content"]
    else:
        token = os.getenv("HF_API_TOKEN")
        model = os.getenv("HF_MODEL", "LGAI-EXAONE/EXAONE-3.5-7.8B-Instruct")
        client = InferenceClient(token=token)
        response = client.chat_completion(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            max_tokens=1024,
        )
        return response.choices[0].message.content


def analyze_image_item(base64_image: str) -> str:
    """이미지에서 분리수거 품목명 추출"""
    # Ollama 멀티모달: exaone3.5는 텍스트 전용이므로 이미지 설명 요청 방식 사용
    use_ollama = os.getenv("USE_OLLAMA", "true").lower() == "true"

    if use_ollama:
        model = os.getenv("OLLAMA_MODEL", "exaone3.5")
        response = ollama.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": "이 이미지에서 분리수거할 품목을 찾아 품목명만 짧게 답해줘. 예: 페트병, 종이컵, 캔",
                "images": [base64_image.split(",")[1] if "," in base64_image else base64_image],
            }],
        )
        return response["message"]["content"].strip()
    else:
        # HuggingFace: 멀티모달 모델로 전환 필요 시 여기 수정
        return _get_response(
            "분리수거할 품목 이름을 한 단어로 추정해줘. 예: 페트병, 종이컵, 캔"
        )


def get_recycling_guide(item_name: str, waste_info: dict | None) -> dict:
    """품목 + 지역 배출정보 기반 분리수거 가이드 생성"""
    region_context = ""
    if waste_info:
        region_context = f"""
지역 배출 정보 ({waste_info.get('시도명', '')} {waste_info.get('시군구명', '')}):
- 재활용품 배출방법: {waste_info.get('재활용품배출방법', '')}
- 재활용품 배출요일: {waste_info.get('재활용품배출요일', '')}
- 재활용품 배출시각: {waste_info.get('재활용품배출시작시각', '')} ~ {waste_info.get('재활용품배출종료시각', '')}
- 배출장소: {waste_info.get('배출장소', '')}
"""

    prompt = f"""당신은 한국의 분리수거 전문가입니다.
품목: "{item_name}"
{region_context}

위 품목의 올바른 분리수거 방법을 아래 JSON 형식으로만 답해주세요.
다른 텍스트 없이 JSON만 출력하세요.

{{
  "itemName": "품목명",
  "category": "분류 (플라스틱/종이/유리/금속/일반쓰레기/음식물/특수폐기물 중 하나)",
  "isRecyclable": true 또는 false,
  "disposalSteps": ["배출 단계 1", "배출 단계 2", "배출 단계 3"],
  "tips": ["주의사항 1", "주의사항 2"],
  "source": "근거 출처"
}}"""

    raw = _get_response(prompt)
    # JSON 파싱
    cleaned = raw.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(cleaned)
