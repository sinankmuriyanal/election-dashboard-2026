#!/usr/bin/env python3
"""Debug script — writes what the ECI pages actually contain to debug_output.txt."""
import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

from playwright.sync_api import sync_playwright
try:
    from playwright_stealth import stealth_sync
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False
from bs4 import BeautifulSoup
import re, time

BASE = "https://results.eci.gov.in/ResultAcGenMay2026"

def show_page(page, url, label=""):
    time.sleep(1.5)
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(2500)
        html = page.content()
        bs = BeautifulSoup(html, "lxml")
        title = bs.title.string if bs.title else "no title"
        print(f"\n{'─'*60}")
        print(f"URL:   {url}")
        print(f"Title: {title}")
        print(f"Body first 800 chars:")
        body = bs.get_text(separator=" ", strip=True)[:800]
        print(body)
        print(f"\nAll links on page:")
        for a in bs.find_all("a", href=True)[:30]:
            print(f"  {a.get_text(strip=True)[:40]:<42} → {a['href'][:80]}")
        print(f"\nAll table headers found:")
        for i, table in enumerate(bs.find_all("table")[:5]):
            headers = [th.get_text(strip=True) for th in table.find_all(["th","td"])[:10]]
            print(f"  Table {i}: {headers}")
    except Exception as e:
        print(f"  ERROR: {e}")

with sync_playwright() as pw:
    browser = pw.chromium.launch(headless=False, slow_mo=150)
    ctx = browser.new_context(
        viewport={"width": 1280, "height": 900},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        locale="en-IN",
    )
    page = ctx.new_page()
    if HAS_STEALTH:
        stealth_sync(page)

    # 1. Index page
    show_page(page, f"{BASE}/index.htm", "Index")

    # 2. Try confirmed working state URLs
    for url in [
        f"{BASE}/partywiseresult-U07.htm",   # Puducherry (confirmed)
        f"{BASE}/partywiseresult-S03.htm",   # Assam (confirmed)
        f"{BASE}/partywiseresult-S11.htm",   # Kerala (confirmed)
        f"{BASE}/partywiseresult-S22.htm",   # West Bengal (confirmed)
        f"{BASE}/partywiseresult-S25.htm",   # Tamil Nadu (confirmed)
    ]:
        show_page(page, url)

    browser.close()
