import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

html = urllib.request.urlopen(
    urllib.request.Request(
        "https://qubik.one/catalog/planters-pots/urban-block-planter/",
        headers={"User-Agent": "Mozilla/5.0"},
    ),
    timeout=90,
).read().decode("utf-8", "ignore")

paths = re.findall(r'(/assets/images/products/(?:602|603|604)/(?:webp|coub)/[^"\']+)', html)
for p in dict.fromkeys(paths):
    print(p)
