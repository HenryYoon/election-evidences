# -*- coding: utf-8 -*-
"""scripts/deident_text.py 실명 추출. 실행: python -m unittest discover -s tests/python
이름은 모두 자리표시다."""
import os, sys, unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
import deident_text as D  # noqa: E402


def rec(reporter, source="카카오톡"):
    return {"reporter": reporter, "source": source}


class NameDeny(unittest.TestCase):
    def test_role_alone_is_not_a_name(self):
        # 제보자 칸이 "참관인"뿐이면 본문의 "참관인"을 가리면 안 된다(ev-012, 027, 038, 042, 043, 087).
        deny = D.build_name_deny([rec("참관인"), rec("투표참관인"), rec("선거인")])
        self.assertEqual(deny, set())
        self.assertEqual(D.redact_text("이에 참관인 4명 이의제기", deny), "이에 참관인 4명 이의제기")

    def test_name_with_role_is_masked_but_role_stays(self):
        deny = D.build_name_deny([rec("참관인 홍길동")])
        self.assertEqual(deny, {"홍길동"})
        self.assertEqual(D.redact_text("참관인 홍길동이 신고", deny), "참관인 ○○○이 신고")

    def test_plain_name_is_masked(self):
        self.assertEqual(D.build_name_deny([rec("홍길동")]), {"홍길동"})

    def test_press_reporter_is_public(self):
        self.assertEqual(D.build_name_deny([rec("홍길동", source="기사")]), set())

    def test_phone_is_removed(self):
        self.assertEqual(D.redact_text("연락 010-0000-0000", set()), "연락 [전화번호]")


if __name__ == "__main__":
    unittest.main()
