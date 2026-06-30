import urllib.request

BASE = "https://cubik.one/assets/images/products/{pid}/{kind}/{name}"

PRODUCTS = {
    376: ["b1", "b2", "b3", "b4", "1", "2", "3", "bar", "bar-1", "bar-2", "bar-counter", "51", "51-2"],
    601: ["12.1", "12.2", "12.3", "1", "2", "3", "hedgerow", "hedge"],
    427: ["table-1", "table-2", "table-3", "table-4", "403"],
    754: [],
    761: ["403", "404", "1", "2"],
    188: ["5", "51", "51-2", "5-2", "1", "2", "3"],
    350: ["5", "1", "2", "3"],
    661: ["1", "2", "3"],
}

for pid, names in PRODUCTS.items():
    found = []
    for kind in ("webp", "coub"):
        for name in names:
            for ext in (".webp", ".jpg", ".jpeg", ".png"):
                url = BASE.format(pid=pid, kind=kind, name=name) + ext
                try:
                    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        if resp.status == 200:
                            found.append(url)
                except Exception:
                    pass
    if found:
        print(f"product {pid}:")
        for url in found:
            print(" ", url)
