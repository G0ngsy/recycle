"""
Management-number keyed waste records → Neo4j Aura migration script.
Run once: python scripts/migrate_to_neo4j.py
"""
import json
import os
import sys
from pathlib import Path
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USERNAME", os.getenv("NEO4J_USER", "neo4j"))
PASSWORD = os.getenv("NEO4J_PASSWORD")

DATA_PATH = Path(__file__).parent.parent / "data" / "waste_records.json"


def load_regional_data() -> list[dict]:
    with DATA_PATH.open(encoding="utf-8") as source:
        packed = json.load(source)
    return [dict(zip(packed["fields"], values, strict=True)) for values in packed["records"]]


def create_constraints(session):
    session.run("CREATE CONSTRAINT region_id IF NOT EXISTS FOR (r:Region) REQUIRE r.id IS UNIQUE")
    session.run("CREATE CONSTRAINT item_name IF NOT EXISTS FOR (i:Item) REQUIRE i.name IS UNIQUE")
    session.run("CREATE CONSTRAINT category_name IF NOT EXISTS FOR (c:Category) REQUIRE c.name IS UNIQUE")


def migrate_regions(session, rows: list[dict]):
    for start in range(0, len(rows), 250):
        batch = rows[start:start + 250]
        session.run(
            """
            UNWIND $rows AS row
            MERGE (r:Region {id: row.`관리번호`})
            SET r.sido = row.`시도명`,
                r.sigungu = row.`시군구명`,
                r.management_area = row.`관리구역명`,
                r.target_area = row.`관리구역대상지역명`,
                r.collection_type = row.`배출장소유형`,
                r.disposal_place = row.`배출장소`,
                r.recyclable_days = row.`재활용품배출요일`,
                r.recyclable_start = row.`재활용품배출시작시각`,
                r.recyclable_end = row.`재활용품배출종료시각`,
                r.waste_method = row.`생활쓰레기배출방법`,
                r.food_method = row.`음식물쓰레기배출방법`,
                r.recycle_method = row.`재활용품배출방법`,
                r.data_date = row.`데이터기준일자`
            """,
            rows=batch,
        )


ITEM_GRAPH = [
    # (item_name, category, is_recyclable, disposal_steps, tips)
    ("페트병", "플라스틱", True,
     ["내용물을 비우고 헹군다", "라벨을 제거한다", "찌그러뜨려 부피를 줄인다", "페트병 전용 수거함에 배출"],
     ["유색 페트병은 별도 분리", "뚜껑은 따로 분리"]),
    ("유리병", "유리", True,
     ["내용물을 비우고 헹군다", "유리병 전용 수거함에 배출"],
     ["깨진 유리는 신문지로 감싸 일반쓰레기", "도자기류는 재활용 불가"]),
    ("종이", "종이", True,
     ["이물질 제거 후 묶어서 배출", "종이 수거함에 배출"],
     ["음식물 묻은 종이는 일반쓰레기", "코팅된 종이는 재활용 불가"]),
    ("캔", "금속", True,
     ["내용물을 비우고 헹군다", "찌그러뜨려 캔 수거함에 배출"],
     ["부탄가스 캔은 구멍 뚫은 후 배출"]),
    ("스티로폼", "스티로폼", True,
     ["이물질 제거 후 스티로폼 수거함에 배출"],
     ["테이프·라벨 제거 필수", "색 있는 스티로폼은 일반쓰레기"]),
    ("비닐", "비닐", True,
     ["이물질 제거 후 비닐 수거함에 배출"],
     ["오염된 비닐은 일반쓰레기"]),
    ("형광등", "형광등", True,
     ["전용 수거함 또는 주민센터에 배출"],
     ["깨진 형광등은 신문지로 감싸 별도 배출"]),
    ("배터리", "배터리", True,
     ["전용 수거함에 배출"],
     ["리튬 배터리는 별도 배출"]),
    ("음식물쓰레기", "음식물", False,
     ["물기 제거 후 음식물 전용 수거함에 배출"],
     ["뼈·조개껍데기·복숭아씨는 일반쓰레기"]),
    ("영수증", "종이", False,
     ["일반쓰레기로 배출"],
     ["감열지(영수증)는 재활용 불가"]),
]


def migrate_items(session):
    for item_name, category, recyclable, steps, tips in ITEM_GRAPH:
        session.run(
            """
            MERGE (c:Category {name: $category})
            MERGE (i:Item {name: $item_name})
            SET i.is_recyclable = $recyclable,
                i.disposal_steps = $steps,
                i.tips = $tips
            MERGE (i)-[:IS_A]->(c)
            """,
            item_name=item_name,
            category=category,
            recyclable=recyclable,
            steps=steps,
            tips=tips,
        )


def main():
    if not URI or not PASSWORD:
        print("NEO4J_URI / NEO4J_PASSWORD 환경변수를 .env에 추가하세요.")
        sys.exit(1)

    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
    print("Neo4j 연결 중...")
    driver.verify_connectivity()
    print("연결 성공")

    with driver.session() as session:
        create_constraints(session)
        print("제약조건 생성 완료")

        rows = load_regional_data()
        migrate_regions(session, rows)
        print(f"지역 데이터 {len(rows)}건 마이그레이션 완료")

        migrate_items(session)
        print(f"품목 데이터 {len(ITEM_GRAPH)}건 마이그레이션 완료")

    driver.close()
    print("마이그레이션 완료")


if __name__ == "__main__":
    main()
