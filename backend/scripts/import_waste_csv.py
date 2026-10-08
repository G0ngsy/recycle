"""Validate the public waste CSV and build the bundled app dataset.

Usage: python backend/scripts/import_waste_csv.py path/to/생활쓰레기배출정보.csv
"""

import argparse
import csv
import json
from datetime import date
from pathlib import Path


REQUIRED_COLUMNS = (
    "관리번호",
    "시도명",
    "시군구명",
    "관리구역명",
    "관리구역대상지역명",
    "배출장소유형",
    "배출장소",
    "재활용품배출방법",
    "재활용품배출요일",
    "재활용품배출시작시각",
    "재활용품배출종료시각",
    "데이터기준일자",
)
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "data" / "waste_records.json"


def convert(source: Path, output: Path, expected_count: int = 10187) -> int:
    with source.open("r", encoding="cp949", newline="") as stream:
        reader = csv.DictReader(stream)
        if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
            raise ValueError("CSV 헤더가 없거나 중복되었습니다.")
        missing = set(REQUIRED_COLUMNS) - set(reader.fieldnames)
        if missing:
            raise ValueError(f"필수 열이 없습니다: {', '.join(sorted(missing))}")
        records = list(reader)

    if len(records) != expected_count:
        raise ValueError(f"행 수 불일치: 예상 {expected_count}, 실제 {len(records)}")

    ids: set[str] = set()
    for line, record in enumerate(records, start=2):
        if None in record or any(value is None for value in record.values()):
            raise ValueError(f"{line}행의 열 수가 헤더와 다릅니다.")
        record_id = record["관리번호"].strip()
        if not record_id or record_id in ids:
            raise ValueError(f"{line}행의 관리번호가 비었거나 중복되었습니다: {record_id}")
        ids.add(record_id)
        for column in ("시도명", "시군구명", "데이터기준일자"):
            if not record[column].strip():
                raise ValueError(f"{line}행의 {column}이 비었습니다.")
        try:
            date.fromisoformat(record["데이터기준일자"])
        except ValueError as error:
            raise ValueError(f"{line}행의 데이터기준일자가 올바르지 않습니다.") from error

    output.parent.mkdir(parents=True, exist_ok=True)
    packed = {
        "fields": reader.fieldnames,
        "records": [[record[column] for column in reader.fieldnames] for record in records],
    }
    output.write_text(json.dumps(packed, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(records)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--expected-count", type=int, default=10187)
    args = parser.parse_args()
    print(f"변환 완료: {convert(args.source, args.output, args.expected_count)}건 → {args.output}")
