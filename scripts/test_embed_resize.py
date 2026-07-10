"""Проверка высоты iframe embed."""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8765/?embed=1"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(URL, wait_until="networkidle", timeout=120000)
    page.wait_for_timeout(3000)

    metrics = page.evaluate(
        """() => ({
            scrollHeight: document.documentElement.scrollHeight,
            bodyScroll: document.body.scrollHeight,
            offsetHeight: document.documentElement.offsetHeight,
            clientHeight: document.documentElement.clientHeight,
            hero: !!document.querySelector('.discover__slide'),
            collections: !!document.querySelector('.collections'),
            mini: document.querySelector('.creativity__title')?.textContent?.trim(),
            footer: !!document.querySelector('.footer'),
            isEmbed: document.documentElement.classList.contains('is-embed'),
        })"""
    )
    print("direct:", metrics)

    parent = browser.new_page(viewport={"width": 1440, "height": 900})
    parent.goto("about:blank")
    parent.set_content(
        f"""<!doctype html><html><body style="margin:0">
        <iframe id="f" src="{URL}" style="width:100%;border:0;height:7200px" scrolling="no"></iframe>
        <script>
        window.heights = [];
        window.addEventListener('message', function (e) {{
            if (e.data && e.data.type === 'qubik-landing:resize') {{
                window.heights.push(e.data.height);
                document.getElementById('f').style.height = e.data.height + 'px';
            }}
        }});
        </script></body></html>"""
    )
    parent.wait_for_timeout(5000)
    iframe_metrics = parent.evaluate(
        """() => {
            const f = document.getElementById('f');
            const heights = window.heights;
            return {
                count: heights.length,
                first: heights[0] || null,
                last: heights[heights.length - 1] || null,
                iframeHeight: f.offsetHeight,
            };
        }"""
    )
    print("iframe:", iframe_metrics)
    browser.close()
