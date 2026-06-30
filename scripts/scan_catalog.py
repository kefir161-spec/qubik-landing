import re
import urllib.request

html = urllib.request.urlopen(
    urllib.request.Request("https://cubik.one/catalog/", headers={"User-Agent": "Mozilla/5.0"}),
    timeout=60,
).read().decode("utf-8", "ignore")

for slug in ["bar-counter", "modular-dining-set", "hedgerow"]:
    print("===", slug, "===")
    m = re.search(rf'(<a[^>]+href="[^"]*{re.escape(slug)}[^"]*"[^>]*>.*?</a>)', html, re.S | re.I)
    if not m:
        print("card not found")
        continue
    card = m.group(1)
    paths = re.findall(r'(/assets/images/products/\d+/(?:webp|coub)/[^"\'\s>]+\.(?:jpg|jpeg|png|webp))', card, re.I)
    for p in paths:
        print(p)
