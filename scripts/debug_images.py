import re
import urllib.request

URLS = {
    "bar-counter": "https://qubik.one/catalog/cafes-restaurants/bar-counter/",
    "hedgerow": "https://qubik.one/catalog/outdoors/hedgerow/",
}

for name, url in URLS.items():
    print("===", name, "===")
    try:
        html = urllib.request.urlopen(
            urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
            timeout=90,
        ).read().decode("utf-8", "ignore")
    except Exception as exc:
        print("ERR", exc)
        continue
    webps = re.findall(r'/assets/images/products/\d+/webp/[^"\']+', html, re.I)
    print("webp paths:", list(dict.fromkeys(webps))[:10])
    imgs = re.findall(r'<img[^>]+>', html, re.I)
    for tag in imgs[:20]:
        if "webp" in tag or "products" in tag:
            print(tag[:300])
