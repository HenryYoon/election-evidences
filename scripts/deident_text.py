# -*- coding: utf-8 -*-
"""텍스트 비식별화: 전화번호와 제보자 실명을 지운다. 외부 의존성이 없다(CI에서 테스트한다)."""
import re

PHONE_RE = re.compile(r"01[016789][-\s]?\d{3,4}[-\s]?\d{4}")

# 제보자 칸에 이름 대신 들어가는 직함·소속. "참관인 홍길동"처럼 이름과 붙어 오기도 한다.
ROLE_STOP = {"참관인", "기자", "신문", "사무국장", "사무처장", "위원장", "중앙당",
             "부방대", "조사단", "국제신문", "당협위원장", "과장", "처장", "국장"}
# 제보자 칸에 단독으로 와도 이름이 아닌 말. 이 말을 이름으로 보면 본문의 직함까지 ○○○으로 가린다.
NOT_NAME = ROLE_STOP | {"투표참관인", "개표참관인", "참관인단", "사무원", "투표사무원", "선거인",
                        "유권자", "시민", "회원", "관리관", "투표관리관", "당일투표", "사무처", "행정복지"}


def build_name_deny(records):
    """제보자 실명만 보수적으로 추출(핸들/일반어 오탐 방지)."""
    deny = set()
    for r in records:
        rep = r["reporter"].strip()
        if "기사" in r["source"]:            # 공개 언론 제보자는 제외
            continue
        if re.fullmatch(r"[가-힣]{2,4}", rep):  # 순수 한글 실명
            deny.add(rep)
        elif any(role in rep for role in ROLE_STOP):  # "참관인 홍길동" 류
            for tok in re.findall(r"[가-힣]{3,4}", rep):
                deny.add(tok)
        # 그 외(닉네임/영문/문구)는 무시 → 일반어 오탐 방지
    def is_role(t):  # 직함 자체, 직함을 품은 말, 직함의 일부("투표참관인"에서 잘린 "투표참관")
        return any(t in w for w in NOT_NAME) or any(w in t for w in NOT_NAME if len(w) >= 3)
    return {t for t in deny if not is_role(t)}


def redact_text(text, deny):
    text = PHONE_RE.sub("[전화번호]", text)
    for name in sorted(deny, key=len, reverse=True):
        text = text.replace(name, "○○○")
    return text
