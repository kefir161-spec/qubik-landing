import re
import urllib.request

PRODUCTS = {
    "modular-dining-set": ("https://qubik.one/catalog/cafes-restaurants/modular-dining-set/", "427"),
    "urban-block-planter": ("https://qubik.one/catalog/planters-pots/urban-block-planter/", "602"),
    "hedgerow": ("https://qubik.one/catalog/outdoors/hedgerow/", "601"),
    "planter-bench-system": ("https://qubik.one/catalog/public-spaces/planter-bench-system/", "188"),
}

for slug, (url, pid) in PRODUCTS.items():
    print(f"\n=== {slug} (pid {pid}) ===")
    html = urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}),
        timeout=90,
    ).read().decode("utf-8", "ignore")

    paths = re.findall(
        rf'(/assets/images/products/{pid}/(?:webp|coub|large|medium)/[^"\'\s>]+\.(?:jpg|jpeg|png|webp))',
        html,
        re.I,
    )
    paths = list(dict.fromkeys(paths))
    print("from page:", len(paths))
    for p in paths:
        print(" ", p)

    # probe webp folder common names
    names = [
        "table-1", "table-2", "table-3", "table-4", "table-5",
        "1", "2", "3", "4", "5", "6", "7", "8",
        "7.1", "7.2", "51", "51-2", "5", "5-2",
        "12.1", "12.2", "11.1", "11.2", "14.1", "14.2", "5.1", "5.2",
    ]
    found = []
    for kind in ("webp", "coub"):
        for name in names:
            for ext in (".webp", ".jpg"):
                path = f"/assets/images/products/{pid}/{kind}/{name}{ext}"
                url_img = "https://cubik.one" + path
                try:
                    req = urllib.request.Request(url_img, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
                    with urllib.request.urlopen(req, timeout=10) as r:
                        if r.status == 200:
                            found.append(path)
                except Exception:
                    pass
    if found:
        print("probed:")
        for p in dict.fromkeys(found):
            print(" ", p)
