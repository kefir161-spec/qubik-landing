import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "https://qubik.one"
PATH = "/catalog/guest-areas/table/"
SLUG = "guest-table"
OUT_DIR = Path(__file__).resolve().parents[1] / "assets" / "images" / "products" / "featured"
OUT_DIR.mkdir(parents=True, exist_ok=True)

html = urllib.request.urlopen(
    urllib.request.Request(BASE + PATH, headers={"User-Agent": "Mozilla/5.0"}),
    timeout=90,
).read().decode("utf-8", "ignore")

slides = re.findall(
    r'<div class="swiper-slide">.*?<img[^>]+src="([^"]+)"',
    html,
    re.S | re.I,
)
seen = set()
gallery = []
for src in slides:
    if "/small/" in src:
        continue
    key = re.sub(r"\.[a-z]+$", "", src.lower())
    if key in seen:
        continue
    seen.add(key)
    gallery.append(src)

price_m = re.search(r'"price"\s*:\s*"?([0-9.]+)"?', html)
price_eur = float(price_m.group(1)) if price_m else 600
rate = json.load(
    urllib.request.urlopen("https://api.exchangerate-api.com/v4/latest/EUR", timeout=20)
)["rates"]["RUB"]
price_rub = round(price_eur * rate)

print("gallery", len(gallery))
for g in gallery:
    print(g)
print("eur", price_eur, "rub", price_rub)

for old in OUT_DIR.glob("modular-dining-set-*"):
    old.unlink()

for i, src in enumerate(gallery[:2], start=1):
    ext = ".webp" if src.endswith(".webp") else ".jpg"
    dest = OUT_DIR / f"{SLUG}-{i}{ext}"
    url = BASE + src if src.startswith("/") else src
    parsed = urllib.parse.urlsplit(url)
    safe = urllib.parse.urlunsplit(
        (parsed.scheme, parsed.netloc, urllib.parse.quote(urllib.parse.unquote(parsed.path), safe="/:%"), "", "")
    )
    data = urllib.request.urlopen(urllib.request.Request(safe, headers={"User-Agent": "Mozilla/5.0"}), timeout=90).read()
    dest.write_bytes(data)
    print("saved", dest.name, len(data))

plus = len(gallery) - 2 if len(gallery) > 2 else None
print("cubiks", f"+{plus}" if plus else None)
