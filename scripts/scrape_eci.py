#!/usr/bin/env python3
"""
ECI Election Results Scraper — Assembly Elections May 2026
Uses Playwright (real Chromium) to bypass WAF/JS challenges on results.eci.gov.in.

Usage:
    cd scripts
    pip install -r requirements.txt
    python -m playwright install chromium
    python scrape_eci.py [--state puducherry] [--dry-run]

Output:
    ../public/data/{state}/results.json
    ../public/data/{state}/summary.json
    ../public/data/index.json
"""

import argparse
import json
import re
import time
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright, Page, Browser
try:
    from playwright_stealth import stealth_sync
    HAS_STEALTH = True
except ImportError:
    HAS_STEALTH = False

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026"

STATES = {
    "puducherry":   {"code": "U07", "name": "Puducherry",  "total_seats": 30},
    "west_bengal":  {"code": "S22", "name": "West Bengal", "total_seats": 294},
    "assam":        {"code": "S03", "name": "Assam",       "total_seats": 126},
    "kerala":       {"code": "S11", "name": "Kerala",      "total_seats": 140},
    "tamil_nadu":   {"code": "S25", "name": "Tamil Nadu",  "total_seats": 234},
}

RATE_LIMIT = 0.8  # seconds between page loads
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"

# ── Alliance map ──────────────────────────────────────────────────────────────

def load_alliance_map() -> dict:
    path = Path(__file__).parent / "party_alliance_map.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


# ── Browser helpers ───────────────────────────────────────────────────────────

def make_browser(playwright, headless: bool = False) -> Browser:
    """
    headless=False opens a visible Chrome window — better bot bypass.
    headless=True for CI/server use.
    """
    return playwright.chromium.launch(
        headless=headless,
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-infobars",
            "--start-maximized",
        ],
        slow_mo=200,  # slight delay between actions to appear more human
    )


def fetch_html(page: Page, url: str, wait_ms: int = 2000) -> Optional[str]:
    """Navigate to URL and return page HTML after JS renders."""
    try:
        time.sleep(RATE_LIMIT)
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(wait_ms)
        html = page.content()
        # Detect access denied
        if "<title>Access Denied</title>" in html or "Access Denied" in html[:500]:
            print(f"  [ACCESS DENIED] {url}")
            return None
        return html
    except Exception as e:
        err = str(e)
        # Re-raise if page context closed — caller should reopen
        if "closed" in err.lower() or "Target" in err:
            raise
        print(f"  [ERROR] fetch_html({url}): {e}")
        return None


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# ── Party name normalization ──────────────────────────────────────────────────

_NORM_MAP = {
    "COMMUNIST PARTY OF INDIA  (MARXIST)": "CPI(M)",
    "COMMUNIST PARTY OF INDIA (MARXIST)":  "CPI(M)",
    "COMMUNIST PARTY OF INDIA(MARXIST)":   "CPI(M)",
    "COMMUNIST PARTY OF INDIA (M)":        "CPI(M)",
    "COMMUNIST PARTY OF INDIA":            "CPI",
    "INDIAN NATIONAL CONGRESS":            "INC",
    "BHARATIYA JANATA PARTY":              "BJP",
    "ALL INDIA TRINAMOOL CONGRESS":        "TMC",
    "AITC":                                "TMC",
    "DRAVIDA MUNNETRA KAZHAGAM":           "DMK",
    "ALL INDIA ANNA DRAVIDA MUNNETRA KAZHAGAM": "AIADMK",
    "JANATA DAL (UNITED)":                 "JD(U)",
    "JANATA DAL(UNITED)":                  "JD(U)",
    "ALL INDIA N.R. CONGRESS":             "AINRC",
    "ALL INDIA N R CONGRESS":              "AINRC",
    "N.R. CONGRESS":                       "AINRC",
    "NR CONGRESS":                         "AINRC",
    "INDEPENDENT":                         "IND",
    "NONE OF THE ABOVE":                   "NOTA",
}


def normalize_party(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw.strip().upper())
    return _NORM_MAP.get(cleaned, raw.strip())


# ── Index page — discover all state links ─────────────────────────────────────

def discover_state_links(page: Page, state_code: str) -> list[str]:
    """
    Load the ECI index page and find links that reference the given state code.
    Returns list of candidate URLs for this state's result page.
    """
    print(f"  Fetching index page…")
    html = fetch_html(page, f"{BASE_URL}/index.htm", wait_ms=3000)
    if not html:
        return []

    bs = soup(html)
    found = []
    code_lower = state_code.lower()

    for a in bs.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "javascript:", "#")):
            continue
        href_lower = href.lower()
        if code_lower in href_lower or state_code.replace("S", "s") in href_lower:
            full = href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
            found.append(full)

    # Confirmed working patterns (from ECI index page analysis) — put these first
    code_num = re.sub(r"\D", "", state_code)
    prefix = state_code[0]
    patterns = [
        f"{BASE_URL}/partywiseresult-{state_code}.htm",   # confirmed working
        f"{BASE_URL}/ConstituencywiseResult-{state_code}.htm",
        f"{BASE_URL}/ConstituencywiseResult{state_code}.htm",
        f"{BASE_URL}/Constituencywise{state_code}.htm",
        f"{BASE_URL}/partywiseresult{state_code}.htm",
        f"{BASE_URL}/PartyWiseResult{state_code}.htm",
        f"{BASE_URL}/AcResult{state_code}.htm",
    ]
    # Put patterns first (confirmed), then links from index
    return list(dict.fromkeys(patterns + found))  # dedup preserving order


# ── State result page — find constituency links ───────────────────────────────

def get_constituency_links(page: Page, state_slug: str, state_code: str) -> list[dict]:
    """Try each candidate URL until we find a page with constituency data."""
    candidate_urls = discover_state_links(page, state_code)

    for url in candidate_urls:
        print(f"    Trying {url} …", end=" ", flush=True)
        html = fetch_html(page, url, wait_ms=2000)
        if not html:
            print("no response")
            continue

        bs = soup(html)
        links = []
        for a in bs.find_all("a", href=True):
            href = a["href"].strip()
            text = a.get_text(strip=True)
            # Look for candidate-wise or AC-wise result links
            if re.search(r"candidate|CandidateWise|AcResult|acresult", href, re.I):
                num_match = re.search(r"(\d+)", href)
                if num_match:
                    num = int(num_match.group(1))
                    full = href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
                    links.append({"number": num, "name": text or f"AC {num}", "url": full})

        if links:
            print(f"found {len(links)} constituency links")
            # Deduplicate by number
            seen = set()
            unique = []
            for lnk in sorted(links, key=lambda x: x["number"]):
                if lnk["number"] not in seen:
                    seen.add(lnk["number"])
                    unique.append(lnk)
            return unique

        # Also check if the page itself IS a constituency list (table rows)
        tables = bs.find_all("table")
        rows_with_ac = 0
        for t in tables:
            for tr in t.find_all("tr"):
                cells = [td.get_text(strip=True) for td in tr.find_all(["td", "th"])]
                if cells and cells[0].isdigit():
                    rows_with_ac += 1
        if rows_with_ac > 5:
            print(f"found table with {rows_with_ac} rows (will parse inline)")
            return [{"number": -1, "name": "inline", "url": url, "_html": html}]

        print("no constituency data")

    return []


# ── Candidate page parser ─────────────────────────────────────────────────────

def parse_candidate_page(page: Page, url: str, alliance_map: dict,
                         pre_html: str = None) -> Optional[dict]:
    html = pre_html or fetch_html(page, url, wait_ms=1500)
    if not html:
        return None

    bs = soup(html)
    tables = bs.find_all("table")
    candidates_table = None

    for table in tables:
        text = " ".join(c.get_text(" ", strip=True).lower() for c in table.find_all(["th", "td"]))
        if "candidate" in text and ("votes" in text or "vote" in text):
            candidates_table = table
            break

    if not candidates_table:
        # Try any table with enough columns
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) > 3:
                cells = rows[0].find_all(["th", "td"])
                if len(cells) >= 4:
                    candidates_table = table
                    break

    if not candidates_table:
        return None

    rows = candidates_table.find_all("tr")
    col_map = {}
    header_row = 0

    for i, row in enumerate(rows):
        cells = [c.get_text(strip=True).lower() for c in row.find_all(["th", "td"])]
        if any("candidate" in c or "party" in c for c in cells):
            for j, c in enumerate(cells):
                if "sl" in c or (c.strip() in ("#", "no", "sno")):
                    col_map["sl"] = j
                elif "candidate" in c:
                    col_map["name"] = j
                elif "party" in c:
                    col_map["party"] = j
                elif "total" in c and "vote" in c:
                    col_map["votes"] = j
                elif "vote" in c and "votes" not in col_map:
                    col_map["votes"] = j
                elif "%" in c or "pct" in c or "percent" in c:
                    col_map["pct"] = j
                elif "status" in c or "result" in c or "won" in c:
                    col_map["status"] = j
            header_row = i
            break

    if not col_map:
        col_map = {"sl": 0, "name": 1, "party": 2, "votes": 3, "pct": 4, "status": 5}

    candidates = []
    for row in rows[header_row + 1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue

        def cell(idx: int) -> str:
            return cells[idx].get_text(strip=True) if idx < len(cells) else ""

        name = cell(col_map.get("name", 1))
        if not name or name.lower() in ("candidate", "total", "grand total", ""):
            continue

        raw_party = cell(col_map.get("party", 2))
        votes_raw = re.sub(r"[^0-9]", "", cell(col_map.get("votes", 3)))
        votes = int(votes_raw) if votes_raw else 0
        pct_raw = re.sub(r"[^0-9.]", "", cell(col_map.get("pct", 4)))
        pct = float(pct_raw) if pct_raw else 0.0
        status_txt = cell(col_map.get("status", 5)).lower()

        ps = normalize_party(raw_party) if raw_party else "IND"
        alliance = alliance_map.get(ps)

        candidates.append({
            "name": name,
            "party": raw_party.strip() if raw_party else "Independent",
            "partyShort": ps,
            "alliance": alliance,
            "votes": votes,
            "votePct": pct,
            "isWinner": False,
        })

    if not candidates:
        return None

    candidates.sort(key=lambda c: c["votes"], reverse=True)
    candidates[0]["isWinner"] = True

    total_votes = sum(c["votes"] for c in candidates)
    if total_votes > 0:
        for c in candidates:
            if c["votePct"] == 0 and c["votes"] > 0:
                c["votePct"] = round(c["votes"] / total_votes * 100, 2)

    return {"candidates": candidates, "totalVotes": total_votes}


# ── State name / district extraction from summary page ────────────────────────

def extract_ac_info_from_page(page: Page, state_code: str) -> dict[int, dict]:
    """Try to get constituency name + district from the state summary page."""
    info = {}
    code_num = re.sub(r"\D", "", state_code)
    urls_to_try = [
        f"{BASE_URL}/ConstituencywiseResult{state_code}.htm",
        f"{BASE_URL}/partywiseresult-{state_code}.htm",
    ]
    for url in urls_to_try:
        html = fetch_html(page, url, wait_ms=2000)
        if not html:
            continue
        bs = soup(html)
        for table in bs.find_all("table"):
            for row in table.find_all("tr"):
                cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
                if len(cells) >= 2 and cells[0].isdigit():
                    num = int(cells[0])
                    name = cells[1] if len(cells) > 1 else ""
                    district = cells[2] if len(cells) > 2 else ""
                    if name:
                        info[num] = {"name": name, "district": district}
        if info:
            break
    return info


# ── Main state scraper ────────────────────────────────────────────────────────

def scrape_state(page: Page, state_slug: str, state_meta: dict,
                 alliance_map: dict, dry_run: bool = False) -> dict:
    state_code = state_meta["code"]
    state_name = state_meta["name"]
    total_seats = state_meta["total_seats"]

    print(f"\n{'='*60}")
    print(f"Scraping {state_name} ({state_code}) — {total_seats} seats")
    print(f"{'='*60}")

    # Get AC info (names, districts)
    print("  Getting AC names/districts…")
    ac_info = extract_ac_info_from_page(page, state_code)
    print(f"  Got info for {len(ac_info)} ACs")

    # Discover constituency detail page links
    print("  Discovering constituency links…")
    const_links = get_constituency_links(page, state_slug, state_code)
    print(f"  Found {len(const_links)} constituency links")

    if not const_links and not ac_info:
        print(f"  [WARN] No data discoverable for {state_name} — leaving empty")
        return build_empty_state(state_slug, state_name, total_seats)

    # If no links but have AC info, build URLs with known patterns
    if not const_links and ac_info:
        for num in sorted(ac_info.keys()):
            const_links.append({
                "number": num,
                "name": ac_info[num].get("name", f"AC {num}"),
                "url": f"{BASE_URL}/CandidateWiseResult-{state_code}-{num}.htm",
            })
        print(f"  Built {len(const_links)} URLs from AC info")

    if dry_run:
        print(f"  [DRY RUN] Would scrape {len(const_links)} pages")
        for lnk in const_links[:5]:
            print(f"    {lnk['number']:3d}. {lnk['name'][:40]} → {lnk['url']}")
        if len(const_links) > 5:
            print(f"    … and {len(const_links)-5} more")
        return build_empty_state(state_slug, state_name, total_seats)

    # Scrape each constituency
    constituencies = []
    total = len(const_links)

    for i, lnk in enumerate(const_links):
        num = lnk["number"]
        name = ac_info.get(num, {}).get("name") or lnk.get("name") or f"AC {num}"
        district = ac_info.get(num, {}).get("district", "")
        url = lnk["url"]
        pre_html = lnk.get("_html")

        print(f"  [{i+1}/{total}] {name} ({num}) … ", end="", flush=True)

        result = parse_candidate_page(page, url, alliance_map, pre_html=pre_html)

        if result is None:
            # Try alternate URL patterns
            for alt in [
                f"{BASE_URL}/CandidateWiseResult-{state_code}-{num:02d}.htm",
                f"{BASE_URL}/CandidateWiseResult{state_code}{num}.htm",
                f"{BASE_URL}/AcResult-{state_code}-{num}.htm",
            ]:
                result = parse_candidate_page(page, alt, alliance_map)
                if result:
                    break

        if not result or not result.get("candidates"):
            print("SKIPPED (no data)")
            continue

        cands = result["candidates"]
        winner = cands[0]
        runner_up = cands[1] if len(cands) > 1 else cands[0]
        total_votes = result["totalVotes"]
        margin = winner["votes"] - runner_up["votes"]
        margin_pct = round(margin / total_votes * 100, 2) if total_votes > 0 else 0.0

        constituencies.append({
            "id": f"{state_slug}-{num:03d}",
            "assemblyNumber": num,
            "name": name,
            "state": state_slug,
            "district": district,
            "winner": winner,
            "runnerUp": runner_up,
            "margin": margin,
            "marginPct": margin_pct,
            "totalVotes": total_votes,
            "turnout": None,
            "status": "won",
            "candidates": cands,
        })
        print(f"OK — {winner['name']} ({winner['partyShort']}) +{margin:,}")

    print(f"\n  Scraped {len(constituencies)}/{total_seats} constituencies")
    summary = compute_state_summary(state_slug, state_name, total_seats, constituencies)
    return {"summary": summary, "constituencies": constituencies}


# ── Summary computation ───────────────────────────────────────────────────────

def build_empty_state(state_slug: str, state_name: str, total_seats: int) -> dict:
    return {
        "summary": {
            "state": state_slug, "stateName": state_name,
            "totalSeats": total_seats, "seatsReported": 0,
            "seatsLeading": 0, "seatsWon": 0,
            "majorityMark": total_seats // 2 + 1,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "allianceTallies": [], "partyTallies": [],
        },
        "constituencies": [],
    }


def compute_state_summary(state_slug, state_name, total_seats, constituencies) -> dict:
    party_seats  = defaultdict(int)
    party_votes  = defaultdict(int)
    party_meta   = {}
    total_valid  = 0

    for c in constituencies:
        w = c["winner"]
        ps = w["partyShort"]
        party_seats[ps] += 1
        party_votes[ps] += w["votes"]
        party_meta.setdefault(ps, {"party": w["party"], "alliance": w["alliance"]})
        total_valid += c["totalVotes"]

    alliance_seats  = defaultdict(int)
    alliance_votes  = defaultdict(int)
    alliance_parties = defaultdict(list)

    for ps, seats in party_seats.items():
        al = party_meta[ps].get("alliance") or "Others"
        alliance_seats[al] += seats
        alliance_votes[al] += party_votes[ps]

    alliance_tallies = []
    for al, seats in sorted(alliance_seats.items(), key=lambda x: -x[1]):
        vp = round(alliance_votes[al] / total_valid * 100, 2) if total_valid else 0.0
        parties = [
            {"partyShort": ps, "seats": s}
            for ps, s in party_seats.items()
            if (party_meta[ps].get("alliance") or "Others") == al
        ]
        alliance_tallies.append({
            "alliance": al, "seats": seats,
            "totalVotes": alliance_votes[al], "votePct": vp,
            "color": "#94A3B8", "parties": parties,
        })
        for ps in [p["partyShort"] for p in parties]:
            alliance_parties[al].append(ps)

    party_tallies = [
        {
            "party": party_meta[ps]["party"], "partyShort": ps,
            "alliance": party_meta[ps].get("alliance"),
            "seats": party_seats[ps],
            "totalVotes": party_votes[ps],
            "votePct": round(party_votes[ps] / total_valid * 100, 2) if total_valid else 0.0,
            "color": "#94A3B8",
        }
        for ps in sorted(party_seats, key=lambda x: -party_seats[x])
    ]

    return {
        "state": state_slug, "stateName": state_name,
        "totalSeats": total_seats, "seatsReported": len(constituencies),
        "seatsLeading": 0, "seatsWon": len(constituencies),
        "majorityMark": total_seats // 2 + 1,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "allianceTallies": alliance_tallies,
        "partyTallies": party_tallies,
    }


# ── Output ────────────────────────────────────────────────────────────────────

def write_state_data(state_slug: str, data: dict) -> None:
    state_dir = OUTPUT_DIR / state_slug
    state_dir.mkdir(parents=True, exist_ok=True)

    utf8 = "utf-8"
    with open(state_dir / "results.json", "w", encoding=utf8) as f:
        json.dump(data["constituencies"], f, ensure_ascii=False, separators=(",", ":"))

    with open(state_dir / "summary.json", "w", encoding=utf8) as f:
        json.dump(data["summary"], f, ensure_ascii=False, indent=2)

    print(f"  Written: {state_dir}/results.json ({len(data['constituencies'])} constituencies)")
    print(f"  Written: {state_dir}/summary.json")


def update_index_timestamp() -> None:
    index_path = OUTPUT_DIR / "index.json"
    if index_path.exists():
        with open(index_path, encoding="utf-8") as f:
            raw = f.read().lstrip("﻿")
            data = json.loads(raw)
        data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n  Updated index.json timestamp")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", choices=list(STATES.keys()) + ["all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--headless", action="store_true", help="Run browser in headless mode (default: visible)")
    args = parser.parse_args()

    alliance_map = load_alliance_map()
    print(f"Loaded {len(alliance_map)} alliance mappings")

    states_to_scrape = (
        {args.state: STATES[args.state]} if args.state != "all" else STATES
    )

    start = time.time()
    with sync_playwright() as pw:
        browser = make_browser(pw, headless=args.headless)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
            locale="en-IN",
        )
        def new_page():
            p = context.new_page()
            if HAS_STEALTH:
                stealth_sync(p)
            return p

        # Warm up — visit index once to pick up cookies/session
        print("Warming browser session…")
        try:
            warm_page = new_page()
            warm_page.goto(f"{BASE_URL}/index.htm", wait_until="domcontentloaded", timeout=30000)
            warm_page.wait_for_timeout(3000)
            print(f"  Index page loaded: {warm_page.title()}")
            warm_page.close()
            time.sleep(1)
        except Exception as e:
            print(f"  Warning: warmup failed ({e}), continuing anyway")

        for slug, meta in states_to_scrape.items():
            # Fresh page per state
            page = new_page()
            if HAS_STEALTH:
                stealth_sync(page)
            try:
                data = scrape_state(page, slug, meta, alliance_map, dry_run=args.dry_run)
            except Exception as e:
                print(f"  [FATAL] {slug}: {e}")
                data = build_empty_state(slug, meta["name"], meta["total_seats"])
            finally:
                try:
                    page.close()
                except Exception:
                    pass
            if not args.dry_run:
                write_state_data(slug, data)

        browser.close()

    update_index_timestamp()
    print(f"\nDone in {time.time()-start:.0f}s")


if __name__ == "__main__":
    main()
