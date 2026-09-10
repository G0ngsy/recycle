import base64
import binascii
import json
import logging
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.ai_service import get_recycling_guide

logger = logging.getLogger(__name__)
router = APIRouter()
DATA_DIR = Path(__file__).parent.parent / "data"
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png"}
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(5 * 1024 * 1024)))


class ImageRequest(BaseModel):
    image: str


class MarkResponse(BaseModel):
    category: str | None = None
    material: str | None = None
    texts: list[str] = Field(default_factory=list)


class GuideRequest(BaseModel):
    itemName: str = Field(min_length=1, max_length=100)
    category: str = Field(default="", max_length=50)
    material: str = Field(default="", max_length=50)
    sido: str = Field(min_length=1, max_length=30)
    sigungu: str = Field(default="", max_length=30)
    managementArea: str = Field(default="", max_length=100)


class DisposalRuleResponse(BaseModel):
    disposalDays: str = ""
    startTime: str = ""
    endTime: str = ""
    place: str = ""
    method: str = ""


class WasteInfoResponse(BaseModel):
    sido: str
    sigungu: str = ""
    managementArea: str | None = None
    rules: list[DisposalRuleResponse]


class GuideResponse(BaseModel):
    itemName: str
    category: str
    isRecyclable: bool
    disposalSteps: list[str]
    tips: list[str]
    source: str
    wasteInfo: WasteInfoResponse | None = None


class RegionListResponse(BaseModel):
    regions: list[str]


class SigunguListResponse(BaseModel):
    sido: str
    sigungu: list[str]


class AreaListResponse(BaseModel):
    sido: str
    sigungu: str
    areas: list[str]
    required: bool


def load_region_data(sido: str) -> list[dict] | None:
    path = DATA_DIR / f"{sido}.json"
    if not path.exists() or path.parent != DATA_DIR:
        return None
    with open(path, encoding="utf-8") as file:
        return json.load(file)


def load_waste_records(sido: str, sigungu: str, management_area: str = "") -> list[dict] | None:
    data = load_region_data(sido)
    if data is None:
        return None
    if sigungu:
        records = [row for row in data if row.get("시군구명") == sigungu]
        if management_area:
            records = [row for row in records if row.get("관리구역명", "").strip() == management_area]
        return records
    return data[:1]


def list_management_areas(records: list[dict]) -> list[str]:
    return sorted({row.get("관리구역명", "").strip() for row in records if row.get("관리구역명", "").strip()})


def build_disposal_rules(records: list[dict]) -> list[dict]:
    keys = (
        "재활용품배출요일",
        "재활용품배출시작시각",
        "재활용품배출종료시각",
        "배출장소",
        "재활용품배출방법",
    )
    unique: dict[tuple[str, ...], dict] = {}
    for row in records:
        values = tuple(str(row.get(key, "") or "").strip() for key in keys)
        unique.setdefault(
            values,
            {
                "disposalDays": values[0],
                "startTime": values[1],
                "endTime": values[2],
                "place": values[3],
                "method": values[4],
            },
        )
    return list(unique.values())


def validate_image_payload(image: str) -> bytes:
    if not image.startswith("data:") or ";base64," not in image:
        raise HTTPException(status_code=400, detail="JPEG 또는 PNG 형식의 이미지가 필요합니다.")
    header, encoded = image.split(",", 1)
    mime_type = header[5:].split(";", 1)[0].lower()
    if mime_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="JPEG 또는 PNG 이미지만 지원합니다.")
    if (len(encoded) * 3) // 4 > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지 크기는 5MB 이하여야 합니다.")
    try:
        decoded = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(status_code=400, detail="올바르지 않은 이미지 데이터입니다.") from None
    if not decoded:
        raise HTTPException(status_code=400, detail="빈 이미지는 분석할 수 없습니다.")
    if len(decoded) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지 크기는 5MB 이하여야 합니다.")
    return decoded


def _detect_mark(image: str) -> dict:
    from services.image_service import detect_recycle_mark, preprocess_image

    return detect_recycle_mark(preprocess_image(image))


@router.get("/regions", response_model=RegionListResponse)
async def list_regions():
    return {"regions": sorted(path.stem for path in DATA_DIR.glob("*.json"))}


@router.get("/regions/{sido}/sigungu", response_model=SigunguListResponse)
async def list_sigungu(sido: str):
    data = load_region_data(sido)
    if data is None:
        raise HTTPException(status_code=404, detail="지원하지 않는 시·도입니다.")
    sigungu = sorted({row.get("시군구명", "").strip() for row in data if row.get("시군구명", "").strip()})
    return {"sido": sido, "sigungu": sigungu}


@router.get(
    "/regions/{sido}/sigungu/{sigungu}/areas",
    response_model=AreaListResponse,
)
async def list_areas(sido: str, sigungu: str):
    records = load_waste_records(sido, sigungu)
    if records is None:
        raise HTTPException(status_code=404, detail="지원하지 않는 시·도입니다.")
    if not records:
        raise HTTPException(status_code=404, detail="해당 시·군·구를 찾을 수 없습니다.")
    areas = list_management_areas(records)
    return {"sido": sido, "sigungu": sigungu, "areas": areas, "required": bool(areas)}


@router.post("/analyze-image", response_model=MarkResponse)
async def analyze_image(req: ImageRequest):
    validate_image_payload(req.image)
    try:
        return _detect_mark(req.image)
    except ValueError:
        raise HTTPException(status_code=400, detail="이미지를 처리할 수 없습니다.") from None
    except Exception:
        logger.exception("Image analysis failed")
        raise HTTPException(status_code=500, detail="이미지 분석 중 오류가 발생했습니다.") from None


@router.post("/recycling-guide", response_model=GuideResponse)
async def recycling_guide(req: GuideRequest):
    if load_region_data(req.sido) is None:
        raise HTTPException(status_code=404, detail="지원하지 않는 시·도입니다.")
    sigungu_records = load_waste_records(req.sido, req.sigungu)
    if req.sigungu and not sigungu_records:
        raise HTTPException(status_code=404, detail="해당 시·군·구의 배출 정보를 찾을 수 없습니다.")
    areas = list_management_areas(sigungu_records or []) if req.sigungu else []
    if areas and not req.managementArea:
        raise HTTPException(status_code=422, detail="관리구역을 선택해주세요.")
    if req.managementArea and req.managementArea not in areas:
        raise HTTPException(status_code=422, detail="지원하지 않는 관리구역입니다.")
    waste_records = load_waste_records(req.sido, req.sigungu, req.managementArea) or []

    item_name = req.itemName.strip()
    if not item_name:
        raise HTTPException(status_code=422, detail="품목명을 입력해주세요.")
    try:
        # Regional schedules are rendered from structured public data, not summarized by the LLM.
        guide = get_recycling_guide(item_name, None)
        if not isinstance(guide, dict):
            raise ValueError("Invalid guide response")
        if waste_records:
            guide["wasteInfo"] = {
                "sido": req.sido,
                "sigungu": req.sigungu,
                "managementArea": req.managementArea or None,
                "rules": build_disposal_rules(waste_records),
            }
            region = " ".join(filter(None, [req.sido, req.sigungu, req.managementArea]))
            guide["source"] = f"공공데이터 기반 지역 배출 정보 ({region})"
        return guide
    except Exception:
        logger.exception("Recycling guide generation failed")
        raise HTTPException(status_code=500, detail="분리배출 안내 생성 중 오류가 발생했습니다.") from None
