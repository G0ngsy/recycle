"""Search page-addressable text extracted from the supplied recycling guideline."""

import json
import re
from functools import lru_cache
from pathlib import Path


DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "recycling_guideline_pages.json"
PDF_PATH = DATA_PATH.with_name("recycling_guideline_2018.pdf")
SEARCHABLE_PAGES = set(range(5, 26)) | set(range(28, 35))
PAGE_TITLES = {
    5: "생활계 폐기물 분류",
    6: "종이류",
    7: "종이팩·종이컵",
    8: "금속캔·고철류",
    9: "유리병",
    10: "페트병·플라스틱·비닐류",
    11: "스티로폼",
    12: "의류·폐식용유·건전지·형광등",
    13: "분리배출 세부요령",
    14: "분리배출 세부요령",
    15: "분리배출 세부요령",
    16: "폐가전제품·대형폐기물",
    17: "음식물류폐기물",
    18: "음식물류폐기물",
    19: "유해폐기물",
    20: "기타폐기물",
    21: "분리배출 FAQ",
    22: "분리배출 FAQ",
    23: "분리배출 FAQ",
    24: "분리배출 FAQ",
    25: "분리배출 FAQ",
}
ALIASES = {
    "투명페트병": "페트병",
    "페트": "페트병",
    "우유팩": "종이팩",
    "종이박스": "상자류",
    "알루미늄캔": "금속캔",
    "비닐봉지": "비닐류",
}


@lru_cache(maxsize=1)
def guideline() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def _compact_with_positions(value: str) -> tuple[str, list[int]]:
    chars: list[str] = []
    positions: list[int] = []
    for index, char in enumerate(value):
        if char.isalnum():
            chars.append(char.casefold())
            positions.append(index)
    return "".join(chars), positions


def _terms(query: str) -> list[str]:
    full, _ = _compact_with_positions(query)
    if len(full) < 2:
        return []
    parts = re.findall(r"[가-힣]+|[a-zA-Z0-9]+", query)
    terms = [full, ALIASES.get(full, "")]
    terms.extend(part.casefold() for part in parts if len(part) >= 2)
    return list(dict.fromkeys(term for term in terms if len(term) >= 2))


def _excerpt(original: str, start: int, page: int) -> str:
    if page >= 28:
        lines = []
        for line in original[start:].splitlines()[:8]:
            if not line.strip():
                continue
            lines.append(line.strip())
            if re.search(r"(?:배출|처리|반납|버린다)[.!。]?$", line.strip()):
                break
        return "\n".join(lines)[:380]
    excerpt = original[start:start + 380].strip()
    if start + 380 < len(original):
        excerpt = excerpt.rsplit("\n", 1)[0].strip() + "…"
    return excerpt


def search_guideline(query: str, limit: int = 2) -> list[dict]:
    terms = _terms(query)
    if not terms:
        return []
    matches = []
    for entry in guideline()["pages"]:
        page = entry["page"]
        if page not in SEARCHABLE_PAGES:
            continue
        original = entry["text"]
        compact, positions = _compact_with_positions(original)
        best = None
        for term in terms:
            at = compact.find(term)
            if at < 0:
                continue
            start = positions[at]
            line_start = original.rfind("\n", 0, start) + 1
            is_heading = not original[line_start:start].strip()
            score = len(term) * 3 + (90 if term == terms[0] else 0)
            score += 20 if is_heading else 0
            score += 40 if term in _compact_with_positions(PAGE_TITLES.get(page, ""))[0] else 0
            score += 30 if page >= 28 and is_heading else 0
            if best is None or score > best[0]:
                best = score, start
        if best is None:
            continue
        score, start = best
        matches.append((score, page, {
            "page": page,
            "title": PAGE_TITLES.get(page, "분리배출 품목 사전"),
            "excerpt": _excerpt(original, start, page),
        }))
    matches.sort(key=lambda hit: (-hit[0], hit[1]))
    return [hit[2] for hit in matches[:limit]]


def guideline_context(references: list[dict]) -> str:
    return "\n".join(
        f"[환경부 2018년 가이드라인 PDF {ref['page']}쪽: {ref['title']}] "
        f"{ref['excerpt']}"
        for ref in references
    )
