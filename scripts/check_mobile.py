"""Проверка мобильной вёрстки: горизонтальный скролл, hero, свайперы, форма."""
import sys
import urllib.request

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Installing playwright...")
    import subprocess

    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "-q"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080/"

DEVICES = [
    ("iPhone 13", {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}),
    ("iPhone SE", {"viewport": {"width": 375, "height": 667}, "is_mobile": True, "has_touch": True}),
    ("Pixel 7", {"viewport": {"width": 412, "height": 915}, "is_mobile": True, "has_touch": True}),
    ("narrow-360", {"viewport": {"width": 360, "height": 740}, "is_mobile": True, "has_touch": True}),
]

failed = False

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, ctx_kwargs in DEVICES:
        context = browser.new_context(**ctx_kwargs, locale="ru-RU")
        page = context.new_page()
        page.goto(BASE, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2500)

        metrics = page.evaluate(
            """() => {
            const doc = document.documentElement;
            const hero = document.querySelector('.discover__slide');
            const mobileHero = document.querySelector('.sm-vision');
            const submit = document.querySelector('#contactForm button[type="submit"]');
            const swipers = [...document.querySelectorAll('.swiper-collections')].map((el) => ({
                id: el.id,
                slides: el.querySelectorAll('.swiper-slide').length,
                width: el.getBoundingClientRect().width,
            }));
            return {
                overflowX: doc.scrollWidth > window.innerWidth + 1,
                scrollWidth: doc.scrollWidth,
                innerWidth: window.innerWidth,
                heroHeight: hero ? hero.getBoundingClientRect().height : 0,
                mobileHeroShown: mobileHero ? getComputedStyle(mobileHero).display !== 'none' : false,
                submitHeight: submit ? submit.getBoundingClientRect().height : 0,
                swipers,
            };
        }"""
        )

        page.locator("#swiperProducts").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.locator("#material").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        page.locator("#contactForm").scroll_into_view_if_needed()
        page.wait_for_timeout(300)

        issues = []
        if metrics["overflowX"]:
            issues.append(f"overflow {metrics['scrollWidth']}px > {metrics['innerWidth']}px")
        if metrics["heroHeight"] < 280:
            issues.append(f"hero height {metrics['heroHeight']:.0f}px")
        if not metrics["mobileHeroShown"]:
            issues.append("mobile hero hidden")
        if metrics["submitHeight"] < 44:
            issues.append(f"submit {metrics['submitHeight']:.0f}px")
        for sw in metrics["swipers"]:
            if sw["slides"] and sw["width"] < 200:
                issues.append(f"{sw['id'] or 'swiper'} width {sw['width']:.0f}px")

        line = f"{name}: {'; '.join(issues) if issues else 'OK'}"
        print(line)
        if issues:
            failed = True
        context.close()
    browser.close()

sys.exit(1 if failed else 0)
