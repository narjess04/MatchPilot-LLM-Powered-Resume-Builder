"""HTML -> PDF with a headless browser, so the PDF looks exactly like the preview and keeps real text and links.

The HTML comes from the client: it is rendered with JavaScript disabled and every network request blocked
(only inline data: images load), so it cannot reach any URL from the server.
"""

import asyncio
import sys

from playwright.async_api import Route, async_playwright

from .config import get_settings

MAX_HTML_BYTES = 3 * 1024 * 1024  # the CV page plus its CSS and an inline photo


class PdfError(Exception):
    pass


async def _block_network(route: Route) -> None:
    if route.request.url.startswith("data:"):
        await route.continue_()
    else:
        await route.abort()


async def _render(html: str) -> bytes:
    channel = get_settings().pdf_browser_channel or None
    async with async_playwright() as p:
        try:
            browser = await p.chromium.launch(channel=channel)
        except Exception as e:
            raise PdfError(
                "Navigateur introuvable pour créer le PDF (installez-le avec : python -m playwright install chromium)."
            ) from e
        try:
            page = await browser.new_page(java_script_enabled=False)
            await page.route("**/*", _block_network)
            await page.set_content(html, wait_until="load", timeout=15_000)
            return await page.pdf(width="210mm", height="297mm", print_background=True, margin={
                "top": "0", "right": "0", "bottom": "0", "left": "0",
            })
        finally:
            await browser.close()


def _render_in_thread(html: str) -> bytes:
    # Launching the browser needs subprocess support, which uvicorn's event loop lacks on Windows: use a
    # dedicated loop of the right kind in this worker thread
    loop = asyncio.ProactorEventLoop() if sys.platform == "win32" else asyncio.new_event_loop()
    try:
        return loop.run_until_complete(_render(html))
    finally:
        loop.close()


async def html_to_pdf(html: str) -> bytes:
    if len(html.encode()) > MAX_HTML_BYTES:
        raise PdfError("Document trop lourd pour être converti en PDF.")
    return await asyncio.to_thread(_render_in_thread, html)
