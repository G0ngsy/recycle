import base64
import binascii
import logging
import os
from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.ai_service import get_recycling_guide
from services.waste_data import (
    list_sido, list_sigungu as waste_sigungu, normalize_sido,
    public_waste_info, region_records, resolve_record, search_records,
)

logger = logging.getLogger(__name__)
router = APIRouter()
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
    sigungu: str = Field(min_length=1, max_length=30)
    managementId: str | None = Field(default=None, max_length=100)


class WasteInfoResponse(BaseModel):
    관리번호: str
    시도명: str
    시군구명: str
    관리구역명: str | None
    관리구역대상지역명: str | None
    배출장소유형: str | None
    배출장소: str | None
    재활용품배출방법: str | None
    배출요일: str | None
    배출시작시각: str | None
    배출종료시각: str | None
    데이터기준일자: str
    오래된정보: bool


class GuideResponse(BaseModel):
    itemName: str
    category: str
    guideStatus: Literal["ready", "unavailable"]
    isRecyclable: bool | None
    disposalSteps: list[str]
    tips: list[str]
    source: str
    wasteInfo: WasteInfoResponse | None = None


class RegionListResponse(BaseModel):
    regions: list[str]


class SigunguListResponse(BaseModel):
    sido: str
    sigungu: list[str]


class WasteRecordOption(BaseModel):
    관리번호: str
    관리구역명: str
    관리구역대상지역명: str
    배출장소유형: str
    배출장소: str


class WasteRecordListResponse(BaseModel):
    total: int
    records: list[WasteRecordOption]


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
    return {"regions": list_sido()}


@router.get("/regions/{sido}/sigungu", response_model=SigunguListResponse)
async def list_sigungu(sido: str):
    sigungu = waste_sigungu(sido)
    if not sigungu:
        raise HTTPException(status_code=404, detail="지원하지 않는 시·도입니다.")
    return {"sido": normalize_sido(sido), "sigungu": sigungu}


@router.get(
    "/regions/{sido}/sigungu/{sigungu}/waste-records",
    response_model=WasteRecordListResponse,
)
async def list_waste_records(
    sido: str, sigungu: str, q: str = "",
    limit: int = Query(30, ge=1, le=50), offset: int = Query(0, ge=0),
):
    if not region_records(sido, sigungu):
        raise HTTPException(status_code=404, detail="해당 시·군·구의 배출 정보가 없습니다.")
    return search_records(sido, sigungu, q, limit, offset)


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
    item_name = req.itemName.strip()
    if not item_name:
        raise HTTPException(status_code=422, detail="품목명을 입력해주세요.")
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
        # Regional schedules are rendered from structured public data, not summarized by the LLM.
        guide = get_recycling_guide(item_name, None)
        if not isinstance(guide, dict):
            raise ValueError("Invalid guide response")
        guide["wasteInfo"] = public_waste_info(record)
        guide["source"] = "AI 생성 안내"
        return guide
    except Exception:
        logger.exception("Recycling guide generation failed")
        raise HTTPException(status_code=500, detail="분리배출 안내 생성 중 오류가 발생했습니다.") from None
