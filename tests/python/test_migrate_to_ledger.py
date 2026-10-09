# -*- coding: utf-8 -*-
"""scripts/migrate_to_ledger.py 매핑 규칙. 실행: python -m unittest discover -s tests/python"""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
import migrate_to_ledger as M  # noqa: E402


class ParseOccurred(unittest.TestCase):
    def test_full_datetime_gets_kst(self):
        self.assertEqual(M.parse_occurred("2026-06-03 14:30:00"), "2026-06-03T14:30:00+09:00")

    def test_korean_pm(self):
        self.assertEqual(M.parse_occurred("2026.6.3 오후 2시"), "2026-06-03T14:00:00+09:00")

    def test_excel_midnight_is_date_only(self):
        # 엑셀 날짜 셀의 00:00:00은 시각 정보가 아니다. 자정을 지어내지 않는다.
        self.assertEqual(M.parse_occurred("2026-05-29 00:00:00"), "2026-05-29")

    def test_without_year_is_none(self):
        for raw in ("14:37:00", "6/3 14시", "어제", "3일", ""):
            self.assertIsNone(M.parse_occurred(raw), raw)

    def test_invalid_month_is_none(self):
        self.assertIsNone(M.parse_occurred("2026-13-01"))


class PlanPatch(unittest.TestCase):
    def test_status_never_upgraded(self):
        for media in (0, 3):
            p = M.plan_patch({"title": "t", "media_count": media, "photos": [], "media_other": []})
            self.assertIn(p["status"], ("reported", "allegation"))

    def test_existing_values_are_kept(self):
        row = {"title": "t", "status": "document", "claim": "c", "election": "e",
               "occurred_at": "2026-06-03", "sources": [{"title": "x", "url": None}], "media_count": 1}
        self.assertEqual(M.plan_patch(row), {})

    def test_source_without_url(self):
        p = M.plan_patch({"title": "t", "source": "카카오톡 제보", "source_url": ""})
        self.assertEqual(p["sources"], [{"title": "카카오톡 제보", "url": None}])


if __name__ == "__main__":
    unittest.main()
