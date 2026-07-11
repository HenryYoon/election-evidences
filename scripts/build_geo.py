# -*- coding: utf-8 -*-
"""
전국 시도(provinces) + 인천 시군구(incheon-muni) GeoJSON을 웹용으로 경량화.
원본: southkorea-maps (KOSTAT 2018). 없으면 자동 다운로드.
출력: public/geo/provinces.geojson, public/geo/incheon-muni.geojson
"""
import json, os, math, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "scripts", "raw")
OUT = os.path.join(ROOT, "public", "geo")
os.makedirs(RAW, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

SRC = {
    "muni": "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-geo.json",
    "prov": "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-provinces-2018-geo.json",
}

# KOSTAT 2018 시도 코드 → 표준 약칭/슬러그
PROV_META = {
    "11": ("서울", "seoul"), "21": ("부산", "busan"), "22": ("대구", "daegu"),
    "23": ("인천", "incheon"), "24": ("광주", "gwangju"), "25": ("대전", "daejeon"),
    "26": ("울산", "ulsan"), "29": ("세종", "sejong"), "31": ("경기", "gyeonggi"),
    "32": ("강원", "gangwon"), "33": ("충북", "chungbuk"), "34": ("충남", "chungnam"),
    "35": ("전북", "jeonbuk"), "36": ("전남", "jeonnam"), "37": ("경북", "gyeongbuk"),
    "38": ("경남", "gyeongnam"), "39": ("제주", "jeju"),
}

def slugify(name_eng):
    s = name_eng.strip().lower()
    out = []
    for ch in s:
        if ch.isalnum():
            out.append(ch)
        elif ch in " -_":
            out.append("-")
    slug = "".join(out).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return slug


def fetch(key):
    path = os.path.join(RAW, key + ".json")
    if not os.path.exists(path):
        print("downloading", key)
        urllib.request.urlretrieve(SRC[key], path)
    return json.load(open(path, encoding="utf-8"))


def rdp(points, eps):
    """Douglas-Peucker 라인 단순화."""
    if len(points) < 3:
        return points
    dmax, idx = 0.0, 0
    a, b = points[0], points[-1]
    for i in range(1, len(points) - 1):
        d = _perp(points[i], a, b)
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = rdp(points[:idx + 1], eps)
        right = rdp(points[idx:], eps)
        return left[:-1] + right
    return [a, b]


def _perp(p, a, b):
    if a == b:
        return math.hypot(p[0] - a[0], p[1] - a[1])
    dx, dy = b[0] - a[0], b[1] - a[1]
    t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)
    px, py = a[0] + t * dx, a[1] + t * dy
    return math.hypot(p[0] - px, p[1] - py)


def simplify_ring(ring, eps):
    r = [[round(x, 5), round(y, 5)] for x, y in ring]
    r = rdp(r, eps)
    if len(r) >= 3 and r[0] != r[-1]:
        r.append(r[0])
    return r


def simplify_geom(geom, eps):
    t = geom["type"]
    if t == "Polygon":
        rings = [simplify_ring(r, eps) for r in geom["coordinates"]]
        rings = [r for r in rings if len(r) >= 4]
        return {"type": "Polygon", "coordinates": rings} if rings else None
    if t == "MultiPolygon":
        polys = []
        for poly in geom["coordinates"]:
            rings = [simplify_ring(r, eps) for r in poly]
            rings = [r for r in rings if len(r) >= 4]
            if rings:
                polys.append(rings)
        return {"type": "MultiPolygon", "coordinates": polys} if polys else None
    return geom


def centroid(geom):
    """면적 가중 대략 중심(대표점). 링 정점 평균으로 근사."""
    pts = []

    def collect(coords, depth):
        if depth == 0:
            pts.append(coords)
        else:
            for c in coords:
                collect(c, depth - 1)
    if geom["type"] == "Polygon":
        collect(geom["coordinates"][0], 1)
    else:  # MultiPolygon: 가장 큰 폴리곤 외곽 링
        biggest = max(geom["coordinates"], key=lambda p: len(p[0]))
        collect(biggest[0], 1)
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return [round(sum(xs) / len(xs), 5), round(sum(ys) / len(ys), 5)]


def build_provinces():
    data = fetch("prov")
    feats = []
    for f in data["features"]:
        code = str(f["properties"]["code"])
        if code not in PROV_META:
            continue
        name, slug = PROV_META[code]
        geom = simplify_geom(f["geometry"], 0.008)  # 전국 뷰: ~800m 허용
        if not geom:
            continue
        feats.append({
            "type": "Feature",
            "properties": {"code": code, "name": name, "slug": slug,
                           "center": centroid(geom)},
            "geometry": geom,
        })
    return {"type": "FeatureCollection", "features": feats}


def build_municipalities():
    data = fetch("muni")
    feats = []
    seen = {}  # (wide, slug) 중복 방지
    for f in data["features"]:
        code = str(f["properties"]["code"])
        prov_code = code[:2]
        if prov_code not in PROV_META:
            continue
        wide = PROV_META[prov_code][1]
        name = f["properties"]["name"]
        slug = slugify(f["properties"].get("name_eng", code))
        key = (wide, slug)
        if key in seen:
            slug = f"{slug}-{code[-3:]}"  # 드문 중복 회피
        seen[key] = True
        geom = simplify_geom(f["geometry"], 0.0012)  # 시군구: ~120m 허용
        if not geom:
            continue
        feats.append({
            "type": "Feature",
            "properties": {"code": code, "name": name, "slug": slug,
                           "wide": wide, "center": centroid(geom)},
            "geometry": geom,
        })
    return {"type": "FeatureCollection", "features": feats}


def dump(obj, name):
    path = os.path.join(OUT, name)
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    open(path, "w", encoding="utf-8").write(s)
    print(name, f"{len(s)/1024:.0f} KB", len(obj["features"]), "features")


if __name__ == "__main__":
    dump(build_provinces(), "provinces.geojson")
    dump(build_municipalities(), "municipalities.geojson")
