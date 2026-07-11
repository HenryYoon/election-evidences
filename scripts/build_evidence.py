# -*- coding: utf-8 -*-
"""
제보 엑셀 + 미디어 폴더 → 웹용 evidence.json + 썸네일/뷰 이미지 생성.

원칙(사용자 결정):
- 전화번호 컬럼 완전 폐기, 제보자 익명화(기사/언론만 실명 유지)
- 인천 중심: 인천 장소는 정밀 좌표, 그 외 시도는 시도 중심점
- 사진 우선: 이미지 썸네일/뷰 생성. 영상(mp4)·음성(m4a)은 메타데이터만
"""
import openpyxl, json, os, re, glob
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "증거 데이터")
XLSX = os.path.join(DATA_DIR, "제보 6.3 지선.xlsx")
OUT_JSON = os.path.join(ROOT, "public", "data", "evidence.json")
THUMB_DIR = os.path.join(ROOT, "public", "thumbs")
VIEW_DIR = os.path.join(ROOT, "public", "view")
PROV_GEO = os.path.join(ROOT, "public", "geo", "provinces.geojson")
MUNI_GEO = os.path.join(ROOT, "public", "geo", "municipalities.geojson")
for d in (os.path.dirname(OUT_JSON), THUMB_DIR, VIEW_DIR):
    os.makedirs(d, exist_ok=True)

IMG_EXT = (".jpg", ".jpeg", ".png")
VID_EXT = (".mp4",)
AUD_EXT = (".m4a",)

# ── 이미지 PII 정책: 물증 사진만 공개 ──────────────────────────────
# 개인정보(서명·전화·이름·명부·얼굴·대화)가 담기는 문서/캡처/인물 사진은
# 아예 게시하지 않는다. 투표지·투표함·봉인지·개표소 등 물증 사진만 공개.
# 인물(얼굴) 유형 — 제보 설명 기준으로 그 제보의 사진 전부 제외
PERSON_KEYWORDS = ["중복투표", "사위투표", "식별", "인물", "지문"]
# 문서·캡처 유형 — 파일명에 나타나면 그 사진만 제외(물증 사진은 유지)
DOC_KEYWORDS = [
    "이의제기", "이의신청", "수령증", "명부", "명단", "문자", "신분",
    "인스타", "스레드", "카톡", "뉴스기사", "기사", "안내", "서명 거부",
    "제보", "스샷", "캡처",
]

# ── 인천 세부 장소 → 정밀 근사 좌표 + region_basic(플래그십 손보정) ─
# 검단은 행정상 서구, 영종은 중구 소속이라 시군구 자동매칭이 안 되므로 명시.
# (키워드들, basic슬러그, 표시라벨, [lng, lat])
INCHEON_PLACES = [
    (("작전서운", "작전"), "gyeyang-gu", "계양구 작전서운동", [126.7360, 37.5268]),
    (("송도3동", "송도3"), "yeonsu-gu", "연수구 송도3동", [126.6560, 37.3835]),
    (("송도1동", "송도1"), "yeonsu-gu", "연수구 송도1동", [126.6390, 37.3860]),
    (("동춘",), "yeonsu-gu", "연수구 동춘2동", [126.6790, 37.4060]),
    (("선학",), "yeonsu-gu", "연수구 선학체육관", [126.6960, 37.4210]),
    (("가정",), "seo-gu", "서구 가정1동", [126.6740, 37.5180]),
    (("가좌",), "seo-gu", "서구 가좌테니스장 개표소", [126.6690, 37.4900]),
    (("검단",), "seo-gu", "서구 검단 선관위", [126.6610, 37.6030]),
    (("영종",), "jung-gu", "중구 영종 개표소", [126.5230, 37.4900]),
]

# ── 시도 판별: (키워드들, wide slug), 위에서부터 우선 ────────────
WIDE_RULES = [
    (("광주광역시", "광주 북구", "광주 문흥"), "gwangju"),
    (("경기광주", "경기 광주", "평택", "의왕", "고양", "광명", "안양", "성남",
      "분당", "수정구", "용인", "수원", "경기"), "gyeonggi"),
    (("서울", "마포", "동작", "서대문", "송파", "강동", "강서", "은평", "노원",
      "종로", "신촌"), "seoul"),
    (("인천", "계양", "연수", "송도", "동춘", "선학", "검단", "가좌", "영종",
      "남동", "부평", "미추홀"), "incheon"),
    (("부산", "동래"), "busan"),
    (("대구", "달서", "범어", "대명", "성내"), "daegu"),
    (("대전", "대덕", "유성"), "daejeon"),
    (("울산", "울주"), "ulsan"),
    (("세종",), "sejong"),
    (("강원", "원주"), "gangwon"),
    (("충북",), "chungbuk"),
    (("충남",), "chungnam"),
    (("전북",), "jeonbuk"),
    (("전남", "순천"), "jeonnam"),
    (("경북", "포항"), "gyeongbuk"),
    (("경남", "김해", "양산", "창원", "의창"), "gyeongnam"),
    (("제주",), "jeju"),
]
WIDE_LABEL = {
    "seoul": "서울", "busan": "부산", "daegu": "대구", "incheon": "인천",
    "gwangju": "광주", "daejeon": "대전", "ulsan": "울산", "sejong": "세종",
    "gyeonggi": "경기", "gangwon": "강원", "chungbuk": "충북", "chungnam": "충남",
    "jeonbuk": "전북", "jeonnam": "전남", "gyeongbuk": "경북", "gyeongnam": "경남",
    "jeju": "제주",
}

URL_RE = re.compile(r"https?://[^\s]+")
PHONE_RE = re.compile(r"01[016789][-\s]?\d{3,4}[-\s]?\d{4}")

# 장소 앞머리 시도 접두 제거용(긴 것 우선)
WIDE_PREFIXES = sorted([
    "서울특별시", "서울시", "서울", "인천광역시", "인천", "경기도", "경기",
    "부산광역시", "부산", "대구광역시", "대구", "광주광역시", "광주",
    "대전광역시", "대전", "울산광역시", "울산", "세종특별자치시", "세종",
    "강원특별자치도", "강원도", "강원", "충청북도", "충북", "충청남도", "충남",
    "전라북도", "전북", "전라남도", "전남", "경상북도", "경북", "경상남도", "경남",
    "제주특별자치도", "제주도", "제주",
], key=len, reverse=True)


def clean_place(raw):
    s = raw.strip()
    for p in WIDE_PREFIXES:
        if s.startswith(p):
            s = s[len(p):].strip(" ·,")
            break
    return s or raw


def prov_centroids():
    gj = json.load(open(PROV_GEO, encoding="utf-8"))
    return {f["properties"]["slug"]: f["properties"]["center"] for f in gj["features"]}


def muni_tokens(name):
    """'성남시수정구'→{성남시,수정구,수정}, '평택시'→{평택시,평택}."""
    toks = {name}
    if "시" in name and not name.endswith("시"):
        i = name.index("시")
        toks.add(name[: i + 1])                       # 성남시
        rest = name[i + 1:]                            # 수정구
        toks.add(rest)
        toks.add(re.sub(r"[시군구]$", "", rest))       # 수정
    else:
        toks.add(re.sub(r"(특별자치)?[시군구]$", "", name))
    return {t for t in toks if len(t) >= 2}


def muni_index():
    """wide 슬러그 → [(name, tokens, slug, center)]."""
    gj = json.load(open(MUNI_GEO, encoding="utf-8"))
    idx = {}
    for f in gj["features"]:
        p = f["properties"]
        idx.setdefault(p["wide"], []).append(
            (p["name"], muni_tokens(p["name"]), p["slug"], p["center"])
        )
    return idx


def parse_wide(place):
    for keys, slug in WIDE_RULES:
        if any(k in place for k in keys):
            return slug
    return None


def match_muni(place, wide, idx):
    """장소 텍스트에서 해당 시도의 시군구를 최장 토큰 일치로 매칭."""
    best = None
    best_len = 0
    for name, tokens, slug, center in idx.get(wide, []):
        for token in tokens:
            if token in place and len(token) > best_len:
                best = (name, slug, center)
                best_len = len(token)
    return best  # (name, slug, center) or None


def incheon_precise(place):
    for keys, slug, label, coord in INCHEON_PLACES:
        if any(k in place for k in keys):
            return slug, label, coord
    return None, None, None


def anonymize(reporter, source):
    """기사/언론 출처만 실명 유지, 나머지는 익명."""
    if "기사" in source or "기자" in source or "신문" in source or "언론" in source:
        return reporter.strip() or "언론 보도"
    return "익명 제보자"


def clean_source(s):
    s = (s or "").strip()
    base = s.split("(")[0].strip()  # "시그널(부정의혹)" → "시그널"
    m = {"카톡": "카카오톡 제보", "시그널": "시그널 제보", "기사": "언론 보도",
         "스레드": "스레드", "개인시그널": "시그널 제보"}
    for k, v in m.items():
        if base.startswith(k):
            return v
    if "카톡" in base or "카카오" in base:
        return "카카오톡 제보"
    if "시그널" in base:
        return "시그널 제보"
    return base or "제보"


def extract_url(text):
    for u in URL_RE.findall(text):
        if "instagram.com" in u:  # 개인 SNS 계정은 제외(개인정보)
            continue
        return u.rstrip(".,)")
    return ""


def clean_desc(text):
    text = PHONE_RE.sub("", text)
    text = URL_RE.sub("", text)
    text = text.replace("\n", " ").replace("  ", " ")
    return text.strip(" /·,")


def primary_type(kinds):
    if "photo" in kinds:
        return "사진"
    if "video" in kinds:
        return "영상"
    if "audio" in kinds:
        return "음성"
    return "문서"


def load_records():
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb.active

    def g(v, i):
        return (v[i].strip() if i < len(v) and v[i] else "")
    out = []
    for row in ws.iter_rows(values_only=True):
        v = [(str(c) if c is not None else "") for c in row]
        m = re.match(r"^(\d+)(\.0)?$", g(v, 0))
        if not m:
            continue
        if not (g(v, 3) or g(v, 4)):
            continue
        evref = re.match(r"^(\d+)", g(v, 7))  # 증거자료 컬럼 = 실제 파일 번호
        out.append({
            "id": int(m.group(1)),
            "reporter": g(v, 1),
            "time": g(v, 2),
            "place": g(v, 3),
            "desc": g(v, 4),
            "source": g(v, 6),
            "evref": int(evref.group(1)) if evref else None,
        })
    return out


def media_by_num():
    """파일명 선행번호(= 증거자료 번호) 기준으로 그룹핑."""
    by = {}
    for f in os.listdir(DATA_DIR):
        if f.lower().endswith((".xlsx", ".txt")):
            continue
        m = re.match(r"^(\d+)_", f)
        if m:
            by.setdefault(int(m.group(1)), []).append(f)
    for k in by:
        by[k].sort()
    return by


def kind_of(fn):
    e = os.path.splitext(fn)[1].lower()
    if e in IMG_EXT:
        return "photo"
    if e in VID_EXT:
        return "video"
    if e in AUD_EXT:
        return "audio"
    return "doc"


def make_thumb(src, dst, maxpx, quality):
    try:
        im = Image.open(src)
        im = ImageOps.exif_transpose(im)
        im = im.convert("RGB")
        im.thumbnail((maxpx, maxpx))
        im.save(dst, "JPEG", quality=quality, optimize=True)
        return True
    except Exception as e:
        print("  ! thumb fail", os.path.basename(src), e)
        return False


def photo_withheld(fn, desc):
    """개인정보가 담긴 문서/캡처/인물 사진이면 True(비공개)."""
    if any(k in desc for k in PERSON_KEYWORDS):     # 얼굴 등 인물 사진
        return True
    if any(k in fn for k in DOC_KEYWORDS):          # 문서·대화 캡처
        return True
    return False


# ── 텍스트 PII: 전화번호 + 제보자 실명 제거 ──────────────────────
ROLE_STOP = {"참관인", "기자", "신문", "사무국장", "사무처장", "위원장", "중앙당",
             "부방대", "조사단", "국제신문", "당협위원장", "과장", "처장", "국장"}


def build_name_deny(records):
    """제보자 실명만 보수적으로 추출(핸들/일반어 오탐 방지)."""
    deny = set()
    for r in records:
        rep = r["reporter"].strip()
        if "기사" in r["source"]:            # 공개 언론 제보자는 제외
            continue
        if re.fullmatch(r"[가-힣]{2,4}", rep):  # 순수 한글 실명
            deny.add(rep)
        elif any(role in rep for role in ROLE_STOP):  # "참관인 이부숙" 류
            for tok in re.findall(r"[가-힣]{3,4}", rep):
                if tok not in ROLE_STOP:
                    deny.add(tok)
        # 그 외(닉네임/영문/문구)는 무시 → 일반어 오탐 방지
    COMMON = {"당일투표", "사무처", "행정복지", "관리관"}
    return deny - COMMON


def redact_text(text, deny):
    text = PHONE_RE.sub("[전화번호]", text)
    for name in sorted(deny, key=len, reverse=True):
        text = text.replace(name, "○○○")
    return text


def main():
    centroids = prov_centroids()
    munis = muni_index()
    records = load_records()
    media = media_by_num()
    name_deny = build_name_deny(records)
    out = []
    dropped = 0
    for r in records:
        rid = r["id"]
        place = r["place"]
        wide = parse_wide(place)
        basic_slug = basic_label = None
        coord = None
        if wide:
            m = match_muni(place, wide, munis)  # (name, slug, center)
            if m:
                basic_label, basic_slug, coord = m[0], m[1], m[2]
            else:
                coord = centroids.get(wide)
            # 인천 플래그십: 세부 장소 정밀 좌표 + region_basic 보정
            if wide == "incheon":
                slug2, label2, coord2 = incheon_precise(place)
                if coord2:
                    coord = coord2
                    basic_slug = slug2 or basic_slug
                    basic_label = label2 or basic_label
        # 지역모름 → 좌표 없음(지도 미표시)
        unknown = any(k in place for k in ("모름", "불명")) or wide is None

        # 미디어 조인: 증거자료 컬럼 번호로 매칭 + 파일명 지역이 제보 지역과
        # 충돌하면 제외(한 번호에 다른 사건이 섞인 경우 방지)
        files = []
        for f in media.get(r["evref"], []) if r["evref"] else []:
            fwide = parse_wide(f)
            if wide and fwide and fwide != wide:
                dropped += 1
                continue
            files.append(f)

        # 미디어 처리 — 물증 사진만 공개, 문서/캡처/인물 사진은 비공개
        photos, others = [], []
        kinds = set()
        withheld = 0
        for idx, fn in enumerate(files):
            k = kind_of(fn)
            if k == "photo":
                if photo_withheld(fn, r["desc"]):     # 개인정보 사진 → 비공개
                    withheld += 1
                    kinds.add("doc")
                    continue
                stem = f"{rid}_{idx}"
                src = os.path.join(DATA_DIR, fn)
                thumb_ok = make_thumb(src, os.path.join(THUMB_DIR, stem + ".jpg"), 480, 72)
                view_ok = make_thumb(src, os.path.join(VIEW_DIR, stem + ".jpg"), 1400, 82)
                kinds.add("photo")
                photos.append({
                    "thumb": f"/thumbs/{stem}.jpg" if thumb_ok else None,
                    "view": f"/view/{stem}.jpg" if view_ok else None,
                })
            elif k in ("video", "audio"):
                # 영상·음성 원본은 1차 미게시(메타만). 파일명은 실명 포함 가능 → 비노출
                kinds.add(k)
                others.append({"kind": k})
            else:
                kinds.add("doc")
                withheld += 1

        # 표시 장소: 장소텍스트에서 시도 접두 제거(예: "서울 송파구 잠실"→"송파구 잠실")
        place_display = redact_text(clean_place(place) or basic_label or place, name_deny)
        desc_clean = redact_text(clean_desc(r["desc"]), name_deny)

        etype = primary_type(kinds)
        out.append({
            "id": f"ev-{rid:03d}",
            "num": rid,
            "title": desc_clean[:50] or f"제보 #{rid}",
            "description": desc_clean,
            "evidence_type": etype,
            "published": True,   # 공개 여부(관리자 토글). 기본 공개, 검수 후 비공개 가능
            "region_wide": wide,
            "region_wide_label": WIDE_LABEL.get(wide),
            "region_basic": basic_slug,
            "place": place_display,
            "place_raw": place,
            "coordinates": None if unknown else coord,
            "located": not unknown,
            "occurred_raw": r["time"],
            "source": clean_source(r["source"]),
            "source_url": extract_url(r["desc"]),
            "reporter": anonymize(r["reporter"], r["source"]),
            "photos": photos,
            "media_other": others,
            "withheld": withheld,   # 개인정보로 비공개된 자료 수
            "media_count": len(photos) + len(others),
        })

    out.sort(key=lambda e: e["num"])
    json.dump({"evidence": out}, open(OUT_JSON, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    # 요약 통계
    n_photo = sum(1 for e in out if e["photos"])
    n_inc = sum(1 for e in out if e["region_wide"] == "incheon")
    n_unloc = sum(1 for e in out if not e["located"])
    n_withheld = sum(e["withheld"] for e in out)
    print(f"evidence.json: {len(out)} records")
    print(f"  물증 사진 공개: {n_photo}건 | 인천: {n_inc} | 위치미상: {n_unloc} | 지역불일치 제외: {dropped}")
    print(f"  PII 비공개(문서/캡처/인물): {n_withheld}장 | 텍스트 전화·실명 제거 적용")


if __name__ == "__main__":
    main()
