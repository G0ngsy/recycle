import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.image_service import preprocess_image
from services.ai_service import analyze_image_item, get_recycling_guide

router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"


class ImageRequest(BaseModel):
    image: str  # base64


class GuideRequest(BaseModel):
    itemName: str
    category: str = ""
    material: str = ""
    sido: str
    sigungu: str = ""


def load_waste_info(sido: str, sigungu: str) -> dict | None:
    path = DATA_DIR / f"{sido}.json"
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if sigungu:
        item = next((d for d in data if d.get("시군구명") == sigungu), None)
        return item or (data[0] if data else None)
    return data[0] if data else None


@router.post("/analyze-image")
async def analyze_image(req: ImageRequest):
    try:
        from services.image_service import detect_recycle_mark
        processed = preprocess_image(req.image)
        mark = detect_recycle_mark(processed)
        return mark
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recycling-guide")
async def recycling_guide(req: GuideRequest):
    try:
        item_name = req.itemName
        if not item_name and req.category:
            item_name = f"{req.category} ({req.material})" if req.material else req.category
        print(f"[DEBUG] recycling-guide 요청: itemName={item_name}, sido={req.sido}, sigungu={req.sigungu}")
        waste_info = load_waste_info(req.sido, req.sigungu)
        print(f"[DEBUG] waste_info 로드: {waste_info is not None}")
        guide = get_recycling_guide(item_name, waste_info)
        if isinstance(guide, list):
            guide = guide[0]
        if not isinstance(guide, dict):
            raise ValueError(f"Unexpected guide type: {type(guide)}")
        if waste_info:
            guide["wasteInfo"] = {
                "배출요일": waste_info.get("재활용품배출요일", ""),
                "배출시작시각": waste_info.get("재활용품배출시작시각", ""),
                "배출종료시각": waste_info.get("재활용품배출종료시각", ""),
                "배출장소": waste_info.get("배출장소", ""),
                "시도명": waste_info.get("시도명", ""),
                "시군구명": waste_info.get("시군구명", ""),
            }
        return guide
    except Exception as e:
        import traceback
        print(f"[ERROR] recycling-guide 실패: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
