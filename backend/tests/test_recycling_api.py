"""HTTP checks for unambiguous region selection and legacy names."""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import app  # noqa: E402
from services.waste_data import dataset  # noqa: E402


class RecyclingApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.fake_ai = staticmethod(lambda item, info: {
            "itemName": item, "category": "테스트", "guideStatus": "ready", "isRecyclable": True,
            "disposalSteps": [], "tips": [], "source": "테스트",
        })

    def test_region_list_and_legacy_alias(self):
        regions = self.client.get("/api/regions").json()["regions"]
        self.assertEqual(len(regions), 16)
        self.assertIn("전남광주통합특별시", regions)
        alias = self.client.get("/api/regions/전라남도/sigungu")
        self.assertEqual(alias.status_code, 200)
        self.assertEqual(alias.json()["sido"], "전남광주통합특별시")

    def test_search_paging_and_empty_query_result(self):
        path = "/api/regions/강원특별자치도/sigungu/정선군/waste-records"
        result = self.client.get(path, params={"limit": 30, "offset": 0})
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["total"], 2203)
        self.assertEqual(len(result.json()["records"]), 30)
        self.assertEqual(self.client.get(path, params={"q": "no-such-place"}).json()["total"], 0)
        self.assertEqual(self.client.get(path, params={"limit": 51}).status_code, 422)

    def test_ambiguous_and_mismatched_guide_requests(self):
        body = {"itemName": "페트병", "sido": "강원특별자치도", "sigungu": "정선군"}
        self.assertEqual(self.client.post("/api/recycling-guide", json=body).status_code, 409)
        self.assertEqual(self.client.post("/api/recycling-guide", json={**body, "managementId": "bad"}).status_code, 404)
        self.assertEqual(self.client.post("/api/recycling-guide", json={**body, "sigungu": ""}).status_code, 422)
        other_id = next(row["관리번호"] for row in dataset()[0] if row["시군구명"] != "정선군")
        self.assertEqual(self.client.post("/api/recycling-guide", json={**body, "managementId": other_id}).status_code, 404)

    def test_selected_records_keep_distinct_rules(self):
        key, rows = next(
            (key, rows) for key, rows in dataset()[1].items()
            if len({row["재활용품배출요일"] for row in rows}) > 1
        )
        by_day = {row["재활용품배출요일"]: row for row in rows}
        selected = list(by_day.values())[:2]
        with patch("routers.recycling.get_recycling_guide", self.fake_ai):
            results = [self.client.post("/api/recycling-guide", json={
                "itemName": "페트병", "sido": key[0], "sigungu": key[1],
                "managementId": row["관리번호"],
            }) for row in selected]
        self.assertTrue(all(result.status_code == 200 for result in results))
        self.assertEqual([result.json()["wasteInfo"]["관리번호"] for result in results],
                         [row["관리번호"] for row in selected])
        self.assertNotEqual(results[0].json()["wasteInfo"]["배출요일"],
                            results[1].json()["wasteInfo"]["배출요일"])

    def test_single_record_can_be_selected_implicitly(self):
        key = next(key for key, rows in dataset()[1].items() if len(rows) == 1)
        with patch("routers.recycling.get_recycling_guide", self.fake_ai):
            result = self.client.post("/api/recycling-guide", json={
                "itemName": "페트병", "sido": key[0], "sigungu": key[1],
            })
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["wasteInfo"]["관리번호"], dataset()[1][key][0]["관리번호"])


if __name__ == "__main__":
    unittest.main()
