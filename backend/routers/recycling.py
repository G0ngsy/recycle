from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from services.waste_data import (
    list_sido, list_sigungu as waste_sigungu, normalize_sido,
    public_waste_info, region_records, resolve_record, search_records,
)

router = APIRouter()


class ImageRequest(BaseModel):
    image: str  # base64


class GuideRequest(BaseModel):
    itemName: str
    category: str = ""
    material: str = ""
    sido: str
    sigungu: str = ""
    managementId: str | None = None


@router.get("/regions")
async def list_regions():
    return {"regions": list_sido()}


@router.get("/regions/{sido}/sigungu")
async def list_sigungu(sido: str):
    sigungu = waste_sigungu(sido)
    if not sigungu:
        raise HTTPException(status_code=404, detail="지원하지 않는 시·도입니다.")
    return {"sido": normalize_sido(sido), "sigungu": sigungu}


@router.get("/regions/{sido}/sigungu/{sigungu}/waste-records")
async def list_waste_records(
    sido: str, sigungu: str, q: str = "",
    limit: int = Query(30, ge=1, le=50), offset: int = Query(0, ge=0),
):
    if not region_records(sido, sigungu):
        raise HTTPException(status_code=404, detail="해당 시·군·구의 배출 정보가 없습니다.")
    return search_records(sido, sigungu, q, limit, offset)


@router.post("/analyze-image")
async def analyze_image(req: ImageRequest):
    try:
        from services.image_service import detect_recycle_mark, preprocess_image
        processed = preprocess_image(req.image)
        mark = detect_recycle_mark(processed)
        return mark
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/recycling-guide")
async def recycling_guide(req: GuideRequest):
    if not req.sigungu.strip():
        raise HTTPException(status_code=422, detail="시·군·구를 선택해주세요.")
    rows = region_records(req.sido, req.sigungu)
    if not rows:
        raise HTTPException(status_code=404, detail="해당 시·군·구의 배출 정보가 없습니다.")
    if not req.managementId and len(rows) > 1:
        raise HTTPException(status_code=409, detail="세부 관리구역 또는 배출장소를 선택해주세요.")
    record = resolve_record(req.sido, req.sigungu, req.managementId)
    if record is None:
        raise HTTPException(status_code=404, detail="선택한 관리번호가 해당 지역에 없습니다.")

    try:
        from services.ai_service import get_recycling_guide

        item_name = req.itemName
        if not item_name and req.category:
            item_name = f"{req.category} ({req.material})" if req.material else req.category
        print(f"[DEBUG] recycling-guide 요청: itemName={item_name}, sido={req.sido}, sigungu={req.sigungu}")
        waste_info = public_waste_info(record)
        ai_info = {
            **record,
            "재활용품배출방법": waste_info["재활용품배출방법"] or "정보 없음",
            "재활용품배출요일": waste_info["배출요일"] or "정보 없음",
            "재활용품배출시작시각": waste_info["배출시작시각"] or "정보 없음",
            "재활용품배출종료시각": waste_info["배출종료시각"] or "정보 없음",
            "배출장소": waste_info["배출장소"] or "정보 없음",
        }
        guide = get_recycling_guide(item_name, ai_info)
        if isinstance(guide, list):
            guide = guide[0]
        if not isinstance(guide, dict):
            raise ValueError(f"Unexpected guide type: {type(guide)}")
        guide["wasteInfo"] = waste_info
        return guide
    except Exception as e:
        import traceback
        print(f"[ERROR] recycling-guide 실패: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
