"""
Neo4j Aura Graph RAG service.
Falls back gracefully when NEO4J_URI is not configured.
"""
import os
from typing import Optional

_driver = None


def _get_driver():
    global _driver
    if _driver:
        return _driver
    uri = os.getenv("NEO4J_URI")
    user = os.getenv("NEO4J_USERNAME", os.getenv("NEO4J_USER", "neo4j"))
    password = os.getenv("NEO4J_PASSWORD")
    if not uri or not password:
        return None
    from neo4j import GraphDatabase
    _driver = GraphDatabase.driver(uri, auth=(user, password))
    return _driver


def get_item_context(item_name: str) -> Optional[dict]:
    driver = _get_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (i:Item)-[:IS_A]->(c:Category)
                WHERE i.name CONTAINS $name OR $name CONTAINS i.name
                RETURN i.name AS item, c.name AS category,
                       i.is_recyclable AS recyclable,
                       i.disposal_steps AS steps,
                       i.tips AS tips
                LIMIT 1
                """,
                name=item_name,
            )
            record = result.single()
            if record:
                return dict(record)
    except Exception:
        pass
    return None


def get_region_context(sido: str, sigungu: str) -> Optional[dict]:
    driver = _get_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            region_id = f"{sido}_{sigungu}" if sigungu else sido
            result = session.run(
                """
                MATCH (r:Region {id: $id})
                RETURN r.disposal_place AS place,
                       r.recyclable_days AS days,
                       r.recyclable_start AS start,
                       r.recyclable_end AS end,
                       r.recycle_method AS method
                """,
                id=region_id,
            )
            record = result.single()
            if record:
                return dict(record)
            # fallback: sido only
            result2 = session.run(
                """
                MATCH (r:Region {sido: $sido})
                RETURN r.disposal_place AS place,
                       r.recyclable_days AS days,
                       r.recyclable_start AS start,
                       r.recyclable_end AS end,
                       r.recycle_method AS method
                LIMIT 1
                """,
                sido=sido,
            )
            record2 = result2.single()
            if record2:
                return dict(record2)
    except Exception:
        pass
    return None


def build_graph_context(item_name: str, sido: str, sigungu: str) -> str:
    item_ctx = get_item_context(item_name)
    region_ctx = get_region_context(sido, sigungu)

    parts = []
    if item_ctx:
        parts.append(
            f"[품목 지식 그래프]\n"
            f"- 품목: {item_ctx['item']} / 분류: {item_ctx['category']}\n"
            f"- 재활용 가능: {'예' if item_ctx['recyclable'] else '아니오'}\n"
            f"- 배출 단계: {' → '.join(item_ctx['steps'])}\n"
            f"- 주의사항: {', '.join(item_ctx['tips'])}"
        )
    if region_ctx:
        parts.append(
            f"[지역 배출 정보]\n"
            f"- 배출 요일: {region_ctx['days']}\n"
            f"- 배출 시간: {region_ctx['start']} ~ {region_ctx['end']}\n"
            f"- 배출 장소: {region_ctx['place']}\n"
            f"- 배출 방법: {region_ctx['method']}"
        )
    return "\n\n".join(parts)
