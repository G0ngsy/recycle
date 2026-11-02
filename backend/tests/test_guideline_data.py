"""The bundled PDF and searchable text must remain in sync and traceable."""

import hashlib
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from services.guideline_data import PDF_PATH, guideline, search_guideline  # noqa: E402
from services.waste_data import dataset  # noqa: E402


class GuidelineDataTests(unittest.TestCase):
    def test_complete_pdf_index_and_source_checksum(self):
        document = guideline()
        self.assertEqual(len(document["pages"]), 36)
        self.assertEqual([page["page"] for page in document["pages"]], list(range(1, 37)))
        self.assertEqual(document["source_sha256"], hashlib.sha256(PDF_PATH.read_bytes()).hexdigest())
        self.assertIn("페트병", document["pages"][9]["text"])
        self.assertIn("분리배출 품목 사전", document["pages"][26]["text"])

    def test_search_finds_main_guidance_and_appendix(self):
        self.assertEqual(search_guideline("페트병")[0]["page"], 10)
        self.assertEqual(search_guideline("우산")[0]["page"], 31)
        self.assertEqual(search_guideline("투명페트병")[0]["page"], 10)
        self.assertEqual(search_guideline("이문서에없는품목xyz"), [])

    def test_api_exposes_search_and_original_pdf(self):
        client = TestClient(app)
        found = client.get("/api/guideline/search", params={"q": "우산"})
        self.assertEqual(found.status_code, 200)
        self.assertEqual(found.json()["results"][0]["page"], 31)
        self.assertEqual(found.json()["published"], "2018-07-03")
        self.assertEqual(client.get("/api/guideline/search", params={"q": "우산", "limit": 6}).status_code, 422)
        pdf = client.get("/api/guideline/pdf")
        self.assertEqual(pdf.status_code, 200)
        self.assertEqual(pdf.content[:4], b"%PDF")

    def test_guide_keeps_pdf_references_when_ai_is_unavailable(self):
        key = next(key for key, rows in dataset()[1].items() if len(rows) == 1)
        client = TestClient(app)
        with patch("routers.recycling.get_recycling_guide", return_value={
            "itemName": "페트병", "category": "확인 필요", "guideStatus": "unavailable",
            "isRecyclable": None, "disposalSteps": [], "tips": [], "source": "AI",
        }) as ai:
            response = client.post("/api/recycling-guide", json={
                "itemName": "페트병", "sido": key[0], "sigungu": key[1],
            })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["guidelineReferences"][0]["page"], 10)
        self.assertEqual(response.json()["guideStatus"], "unavailable")
        self.assertIsNone(response.json()["isRecyclable"])
        self.assertIn("페트병", ai.call_args.kwargs["guideline_context"])


if __name__ == "__main__":
    unittest.main()
