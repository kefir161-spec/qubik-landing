import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

html = urllib.request.urlopen(
    urllib.request.Request("https://qubik.one/catalog/", headers={"User-Agent": "Mozilla/5.0"}),
    timeout=90,
).read().decode("utf-8", "ignore")

SLUGS = [
    "modular-dining-set",
    "urban-block-planter",
    "hedgerow",
    "planter-bench-system",
]

for slug in SLUGS:
    print(f"\n=== {slug} ===")
    m = re.search(rf'<a[^>]+href="[^"]*{re.escape(slug)}[^"]*"[^>]*>', html, re.I)
    if not m:
        print("not found")
        continue

    # card likely starts at previous card boundary
    before = html[: m.start()]
    card_start = before.rfind('<div class="card')
    if card_start < 0:
        card_start = before.rfind('<a class="card')
    if card_start < 0:
        card_start = max(0, m.start() - 3000)

    after = html[m.start() :]
    card_end_rel = re.search(r'</a>\s*</div>\s*<div class="card', after, re.I)
    if not card_end_rel:
        card_end_rel = re.search(r'</a>\s*</div>\s*<a ', after[m.end() - m.start() :], re.I)
    card_end = m.start() + (card_end_rel.end() if card_end_rel else 2500)
    card = html[card_start:card_end]

    imgs = re.findall(
        r'(?:src|data-src)=["\']([^"\']*/assets/images/products/\d+/coub/[^"\']+)["\']',
        card,
        re.I,
    )
    imgs = list(dict.fromkeys(imgs))
    plus = re.search(r'>\s*\+\s*(\d+)\s*<', card)
    print("images:", len(imgs))
    for img in imgs:
        print(" ", img)
    if plus:
        print(" plus:", plus.group(1))
