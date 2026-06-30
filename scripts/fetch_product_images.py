import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "https://qubik.one"
PRODUCTS = {
    "guest-table": "/catalog/guest-areas/table/",
    "urban-block-planter": "/catalog/planters-pots/urban-block-planter/",
    "hedgerow": "/catalog/outdoors/hedgerow/",
    "planter-bench-system": "/catalog/public-spaces/planter-bench-system/",
}
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "images" / "products" / "featured"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch(path: str) -> str:
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read().decode("utf-8", "ignore")


def image_key(url: str) -> str:
    m = re.search(r"/products/(\d+)/(?:webp|coub|large|medium)?/?([^/]+?)(?:\.[a-z]+)?$", url, re.I)
    if m:
        return f"{m.group(1)}:{m.group(2).lower()}"
    return url.lower()


def gallery_from_page(html: str) -> list[str]:
    images: list[str] = []
    seen: set[str] = set()

    def add(url: str) -> None:
        if "/assets/images/products/" not in url or "/small/" in url:
            return
        key = image_key(url)
        if key in seen:
            return
        seen.add(key)
        images.append(url)

    for src in re.findall(
        r'<div class="swiper-slide">.*?<img[^>]+src="([^"]+)"',
        html,
        re.S | re.I,
    ):
        add(src)

    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict) or data.get("@type") != "Product":
            continue
        img = data.get("image")
        if isinstance(img, str):
            add(img)
        elif isinstance(img, list):
            for item in img:
                if isinstance(item, str):
                    add(item)

    return images


def encode_url(url: str) -> str:
    if url.startswith("/"):
        url = BASE + url
    parsed = urllib.parse.urlsplit(url)
    path = urllib.parse.quote(urllib.parse.unquote(parsed.path), safe="/:%")
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, path, parsed.query, parsed.fragment))


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(encode_url(url), headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=90) as resp:
        dest.write_bytes(resp.read())


def ext(url: str) -> str:
    m = re.search(r"\.(jpe?g|png|webp)$", url, re.I)
    return "." + m.group(1).lower().replace("jpeg", "jpg") if m else ".jpg"


manifest = {}
for slug, path in PRODUCTS.items():
    print(f"\n=== {slug} ===")
    html = fetch(path)
    gallery = gallery_from_page(html)
    print("gallery", len(gallery))
    for g in gallery:
        print(" ", g)

    for old in OUT_DIR.glob(f"{slug}-*"):
        old.unlink()

    local = []
    for i, src in enumerate(gallery[:2], start=1):
        dest = OUT_DIR / f"{slug}-{i}{ext(src)}"
        print("DL", dest.name)
        download(src, dest)
        local.append(f"assets/images/products/featured/{dest.name}")

    total = len(gallery)
    plus = total - 2 if total > 2 else None
    manifest[slug] = {"images": local, "galleryTotal": total, "cubiks": f"+{plus}" if plus else None}

Path(__file__).resolve().parents[1].joinpath("scripts", "gallery-manifest.json").write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
