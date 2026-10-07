"""Read the validated, management-number keyed waste disposal dataset."""

import json
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "waste_records.json"
SIDO_ALIASES = {
    "광주광역시": "전남광주통합특별시",
    "전라남도": "전남광주통합특별시",
    "전라북도": "전북특별자치도",
    "강원도": "강원특별자치도",
}
EMPTY_VALUES = {"", "없음", "해당없음", "기타"}
KST = timezone(timedelta(hours=9))


def normalize_sido(sido: str) -> str:
    return SIDO_ALIASES.get(sido.strip(), sido.strip())


@lru_cache(maxsize=1)
def dataset() -> tuple[list[dict], dict[tuple[str, str], list[dict]], dict[str, dict]]:
    packed = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    fields = packed["fields"]
    records = [dict(zip(fields, values, strict=True)) for values in packed["records"]]
    by_region: dict[tuple[str, str], list[dict]] = defaultdict(list)
    by_id: dict[str, dict] = {}
    for row in records:
        by_region[(row["시도명"], row["시군구명"])].append(row)
        by_id[row["관리번호"]] = row
    for rows in by_region.values():
        rows.sort(key=lambda row: (
            row["관리구역명"], row["관리구역대상지역명"],
            row["배출장소"], row["관리번호"],
        ))
    return records, by_region, by_id


def list_sido() -> list[str]:
    return sorted({row["시도명"] for row in dataset()[0]})


def list_sigungu(sido: str) -> list[str]:
    canonical = normalize_sido(sido)
    return sorted({district for province, district in dataset()[1] if province == canonical})


def region_records(sido: str, sigungu: str) -> list[dict]:
    return dataset()[1].get((normalize_sido(sido), sigungu.strip()), [])


def search_records(sido: str, sigungu: str, query: str = "", limit: int = 30, offset: int = 0) -> dict:
    rows = region_records(sido, sigungu)
    term = query.strip().casefold()
    if term:
        rows = [row for row in rows if any(
            term in row[column].casefold()
            for column in ("관리구역명", "관리구역대상지역명", "배출장소유형", "배출장소", "관리번호")
        )]
    return {
        "total": len(rows),
        "records": [{
            "관리번호": row["관리번호"],
            "관리구역명": row["관리구역명"],
            "관리구역대상지역명": row["관리구역대상지역명"],
            "배출장소유형": row["배출장소유형"],
            "배출장소": row["배출장소"],
        } for row in rows[offset:offset + limit]],
    }


def resolve_record(sido: str, sigungu: str, management_id: str | None) -> dict | None:
    rows = region_records(sido, sigungu)
    if management_id:
        row = dataset()[2].get(management_id)
        return row if row and (row["시도명"], row["시군구명"]) == (normalize_sido(sido), sigungu.strip()) else None
    return rows[0] if len(rows) == 1 else None


def _known(value: str) -> str | None:
    value = value.strip()
    return value if value not in EMPTY_VALUES else None


def public_waste_info(row: dict) -> dict:
    start = _known(row["재활용품배출시작시각"])
    end = _known(row["재활용품배출종료시각"])
    if start == end == "00:00":
        start = end = None
    if end == "2400":
        end = "24:00"
    data_date = date.fromisoformat(row["데이터기준일자"])
    return {
        "관리번호": row["관리번호"],
        "시도명": row["시도명"],
        "시군구명": row["시군구명"],
        "관리구역명": _known(row["관리구역명"]),
        "관리구역대상지역명": _known(row["관리구역대상지역명"]),
        "배출장소유형": _known(row["배출장소유형"]),
        "배출장소": _known(row["배출장소"]),
        "재활용품배출방법": _known(row["재활용품배출방법"]),
        "배출요일": _known(row["재활용품배출요일"]),
        "배출시작시각": start,
        "배출종료시각": end,
        "데이터기준일자": data_date.isoformat(),
        "오래된정보": (datetime.now(KST).date() - data_date).days > 365,
    }
