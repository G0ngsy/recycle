"""AI guide failures must never become a negative recycling verdict."""

import asyncio
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from routers.recycling import GuideRequest, recycling_guide  # noqa: E402
from services.ai_service import get_recycling_guide  # noqa: E402
from services.waste_data import dataset  # noqa: E402


class AiGuideStatusTests(unittest.TestCase):
    def test_valid_boolean_verdicts(self):
        for value in (True, False):
            with self.subTest(value=value):
                with patch("services.ai_service._get_response", return_value=(
                    '{"isRecyclable": true}' if value else '{"isRecyclable": false}'
                )):
                    guide = get_recycling_guide("페트병", None)
                self.assertEqual(guide["guideStatus"], "ready")
                self.assertIs(guide["isRecyclable"], value)

    def test_call_failure_and_invalid_responses_are_unavailable(self):
        responses = ("not JSON", "{}", '{"isRecyclable": "false"}',
                     '{"isRecyclable": 0}', "[]")
        with patch("services.ai_service._get_response", side_effect=RuntimeError("offline")):
            guide = get_recycling_guide("페트병", None)
        self.assertEqual(guide["guideStatus"], "unavailable")
        self.assertIsNone(guide["isRecyclable"])
        self.assertEqual(guide["disposalSteps"], [])
        for raw in responses:
            with self.subTest(raw=raw):
                with patch("services.ai_service._get_response", return_value=raw):
                    guide = get_recycling_guide("페트병", None)
                self.assertEqual(guide["guideStatus"], "unavailable")
                self.assertIsNone(guide["isRecyclable"])

    def test_api_preserves_region_info_on_ai_failure(self):
        key = next(key for key, rows in dataset()[1].items() if len(rows) == 1)
        with patch("services.ai_service._get_response", side_effect=RuntimeError("offline")):
            body = asyncio.run(recycling_guide(GuideRequest(
                itemName="페트병", sido=key[0], sigungu=key[1],
            )))
        self.assertEqual(body["guideStatus"], "unavailable")
        self.assertIsNone(body["isRecyclable"])
        self.assertEqual(body["wasteInfo"]["시군구명"], key[1])


if __name__ == "__main__":
    unittest.main()
