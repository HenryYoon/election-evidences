# -*- coding: utf-8 -*-
"""
이미지 비식별화 — PII 영역 픽셀화+블러(복원 불가)로 마스킹.
입력: _local-data/pii_findings.json (정규화 박스), _local-data/view/*.jpg
출력: 같은 파일 덮어쓰기 + _local-data/thumbs/*.jpg 재생성.
withhold 이미지는 여기서 건드리지 않음(업로드/DB 단계에서 제외).
실행: python scripts/deident_images.py
"""
import os, json
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIEW = os.path.join(ROOT, "_local-data", "view")
THUMB = os.path.join(ROOT, "_local-data", "thumbs")
BACKUP = os.path.join(ROOT, "_local-data", "_orig_backup", "view")
FIND = os.path.join(ROOT, "_local-data", "pii_findings.json")


def redact_region(im, box):
    W, H = im.size
    x0, y0, x1, y1 = box
    px = (max(0, int(x0 * W)), max(0, int(y0 * H)),
          min(W, int(x1 * W)), min(H, int(y1 * H)))
    if px[2] <= px[0] or px[3] <= px[1]:
        return
    region = im.crop(px)
    # 모자이크(픽셀화) 후 가우시안 블러 — 되돌릴 수 없게
    small = (max(1, region.width // 18), max(1, region.height // 18))
    region = region.resize(small, Image.BILINEAR).resize(region.size, Image.NEAREST)
    region = region.filter(ImageFilter.GaussianBlur(6))
    im.paste(region, px)


def ensure_backup(stem):
    """원본 백업이 없으면 현재 view를 백업(최초 처리 전 원본 보존 → 멱등)."""
    os.makedirs(BACKUP, exist_ok=True)
    bp = os.path.join(BACKUP, stem + ".jpg")
    if not os.path.exists(bp):
        vp = os.path.join(VIEW, stem + ".jpg")
        if os.path.exists(vp):
            import shutil
            shutil.copy(vp, bp)
    return bp if os.path.exists(bp) else os.path.join(VIEW, stem + ".jpg")


def save_view_thumb(im, stem):
    im.save(os.path.join(VIEW, stem + ".jpg"), "JPEG", quality=82, optimize=True)
    t = im.copy()
    t.thumbnail((480, 480))
    t.save(os.path.join(THUMB, stem + ".jpg"), "JPEG", quality=72, optimize=True)


def main():
    find = json.load(open(FIND, encoding="utf-8"))
    blur = find["blur"]
    done = 0
    for stem, boxes in blur.items():
        src = ensure_backup(stem)  # 항상 원본에서 시작 → 재실행해도 중복 블러 안 됨
        if not os.path.exists(src):
            print("  ! 없음", stem); continue
        im = Image.open(src).convert("RGB")
        for b in boxes:
            redact_region(im, b)
        save_view_thumb(im, stem)
        done += 1
        print(f"  블러 적용: {stem} ({len(boxes)}영역)")
    # 180° 회전(거꾸로 촬영 보정) — 원본에서 회전
    rot = 0
    for stem in find.get("rotate180", []):
        src = ensure_backup(stem)
        if not os.path.exists(src):
            print("  ! 없음", stem); continue
        im = Image.open(src).convert("RGB").rotate(180, expand=True)
        save_view_thumb(im, stem)
        rot += 1
        print(f"  180° 회전: {stem}")
    print(f"완료: 블러 {done}장, 회전 {rot}장, withhold {len(find['withhold'])}장(업로드 단계 제외)")


if __name__ == "__main__":
    main()
