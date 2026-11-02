"""Extract the supplied 2018 recycling guideline into a page-addressable index."""

import argparse
import hashlib
import json
from pathlib import Path

from pypdf import PdfReader


BASE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = BASE_DIR / "data" / "recycling_guideline_2018.pdf"
DEFAULT_OUTPUT = BASE_DIR / "data" / "recycling_guideline_pages.json"
SOURCE_URL = (
    "https://mcee.go.kr/home/web/board/read.do?boardId=875840&boardMasterId=54"
    "&maxIndexPages=10&maxPageItems=10&menuId=10181&pagerOffset=0"
)


def build_index(source: Path) -> dict:
    reader = PdfReader(source)
    if len(reader.pages) != 36:
        raise ValueError(f"Expected 36 PDF pages, got {len(reader.pages)}")
    pages = [
        {"page": number, "text": (page.extract_text() or "").strip()}
        for number, page in enumerate(reader.pages, start=1)
    ]
    for number, anchor in ((6, "종이류"), (10, "페트병"), (27, "분리배출 품목 사전")):
        if anchor not in pages[number - 1]["text"]:
            raise ValueError(f"Page {number} is missing expected text: {anchor}")
    if any("\ufffd" in page["text"] for page in pages):
        raise ValueError("PDF text extraction contains replacement characters")
    return {
        "title": "재활용품 분리배출 가이드라인",
        "publisher": "환경부",
        "published": "2018-07-03",
        "source_url": SOURCE_URL,
        "source_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "pages": pages,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, nargs="?", default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Verify the saved index without rewriting it")
    args = parser.parse_args()
    contents = json.dumps(build_index(args.source), ensure_ascii=False, indent=2) + "\n"
    if args.check:
        if args.output.read_text(encoding="utf-8") != contents:
            raise SystemExit("The guideline index differs from the source PDF")
        print("Guideline index matches the source PDF")
        return
    args.output.write_text(contents, encoding="utf-8")
    print(f"Indexed 36 pages in {args.output}")


if __name__ == "__main__":
    main()
