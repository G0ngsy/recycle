"""Regression checks for the bundled public waste data and region selection."""

import sys
import unittest
from collections import defaultdict
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.waste_data import (  # noqa: E402
    dataset, list_sido, public_waste_info, region_records,
    resolve_record, search_records,
)


class WasteDataTests(unittest.TestCase):
    def test_bundle_has_every_unique_management_number(self):
        rows, _, by_id = dataset()
        self.assertEqual(len(rows), 10187)
        self.assertEqual(len(by_id), len(rows))
        self.assertEqual(len(list_sido()), 16)

    def test_single_and_multiple_regions_do_not_use_an_arbitrary_first_row(self):
        _, by_region, _ = dataset()
        single_key = next(key for key, rows in by_region.items() if len(rows) == 1)
        multiple_key = next(key for key, rows in by_region.items() if len(rows) > 1)
        self.assertEqual(resolve_record(*single_key, None), by_region[single_key][0])
        self.assertIsNone(resolve_record(*multiple_key, None))
        self.assertIsNone(resolve_record(*single_key, by_region[multiple_key][0]["관리번호"]))

    def test_search_pagination_and_no_match(self):
        sido, sigungu = "강원특별자치도", "정선군"
        first = search_records(sido, sigungu, limit=30)
        second = search_records(sido, sigungu, limit=30, offset=30)
        self.assertEqual(first["total"], 2203)
        self.assertEqual(len(first["records"]), 30)
        self.assertFalse({row["관리번호"] for row in first["records"]} &
                         {row["관리번호"] for row in second["records"]})
        self.assertEqual(search_records(sido, sigungu, "no-such-place")["total"], 0)

    def test_same_district_can_resolve_distinct_disposal_days(self):
        _, by_region, _ = dataset()
        found = None
        for key, rows in by_region.items():
            by_day = defaultdict(list)
            for row in rows:
                by_day[row["재활용품배출요일"]].append(row)
            if len(by_day) > 1:
                found = (key, [values[0] for values in by_day.values()][:2])
                break
        self.assertIsNotNone(found)
        key, rows = found
        selected = [resolve_record(*key, row["관리번호"]) for row in rows]
        self.assertNotEqual(selected[0]["재활용품배출요일"], selected[1]["재활용품배출요일"])

    def test_legacy_province_and_unknown_values(self):
        self.assertEqual(len(region_records("전라남도", "고흥군")), 1311)
        rows = dataset()[0]
        unknown_day = next(row for row in rows if row["재활용품배출요일"] == "기타")
        midnight = next(row for row in rows if row["재활용품배출시작시각"] == row["재활용품배출종료시각"] == "00:00")
        end_of_day = next(row for row in rows if row["재활용품배출종료시각"] == "2400")
        old = next(row for row in rows if row["데이터기준일자"] < "2024-01-01")
        self.assertIsNone(public_waste_info(unknown_day)["배출요일"])
        self.assertIsNone(public_waste_info(midnight)["배출시작시각"])
        self.assertEqual(public_waste_info(end_of_day)["배출종료시각"], "24:00")
        self.assertTrue(public_waste_info(old)["오래된정보"])


if __name__ == "__main__":
    unittest.main()
