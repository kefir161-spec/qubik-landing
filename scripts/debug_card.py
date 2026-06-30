import re
import sys
import urllib.request

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

html = urllib.request.urlopen(
    urllib.request.Request("https://qubik.one/catalog/", headers={"User-Agent": "Mozilla/5.0"}),
    timeout=90,
).read().decode("utf-8", "ignore")

slug = "urban-block-planter"
m = re.search(rf'<a class="card"[^>]+href="[^"]*{re.escape(slug)}[^"]*"[^>]*>', html, re.I)
card = re.search(rf'<a class="card"[^>]+href="[^"]*{re.escape(slug)}[^"]*"[^>]*>.*?</a>', html, re.S | re.I).group(0)
open(r"c:\Users\admin\Desktop\Programs\Landing\scripts\card-sample.html", "w", encoding="utf-8").write(card)
print("len", len(card))
imgs = re.findall(r'src="([^"]+)"', card)
for img in imgs:
    print(img)
print("plus", re.findall(r'>\s*\+\s*(\d+)\s*<', card))
