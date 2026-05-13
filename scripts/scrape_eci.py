#!/usr/bin/env python3
"""
ECI Election Results Scraper — Assembly Elections May 2026
Uses plain HTTP requests (no Playwright required).

URL patterns discovered:
  State summary : {BASE}/partywiseresult-{STATE_CODE}.htm
  AC detail     : {BASE}/statewise{STATE_CODE}{AC_NUM}.htm

Usage:
    cd scripts
    pip install -r requirements.txt
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

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026"
RATE_LIMIT = 1.5   # seconds between requests
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"

# State codes verified from ECI URL structure (S22=Tamil Nadu, S25=West Bengal)
STATES = {
    "puducherry":  {"code": "U07", "name": "Puducherry",  "total_seats": 30},
    "assam":       {"code": "S03", "name": "Assam",       "total_seats": 126},
    "kerala":      {"code": "S11", "name": "Kerala",      "total_seats": 140},
    "tamil_nadu":  {"code": "S22", "name": "Tamil Nadu",  "total_seats": 234},
    "west_bengal": {"code": "S25", "name": "West Bengal", "total_seats": 294},
}

# ── HTTP session ──────────────────────────────────────────────────────────────

_SESSION = requests.Session()
_SESSION.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept-Encoding": "gzip, deflate",
    "Connection": "keep-alive",
})


def fetch_html(url: str, retries: int = 3, extra_wait: float = 0) -> Optional[str]:
    """Fetch a URL and return HTML. Returns None on failure."""
    time.sleep(RATE_LIMIT + extra_wait)
    for attempt in range(retries):
        try:
            _SESSION.headers["Referer"] = f"{BASE_URL}/index.htm"
            r = _SESSION.get(url, timeout=25)
            if r.status_code == 200:
                return r.text
            elif r.status_code == 403:
                wait = 15 * (attempt + 1)
                print(f"  [403] {url} — waiting {wait}s")
                time.sleep(wait)
            elif r.status_code == 404:
                return None  # AC doesn't exist, not an error
            else:
                print(f"  [{r.status_code}] {url}")
                return None
        except requests.RequestException as e:
            print(f"  [ERROR attempt {attempt+1}] {url}: {e}")
            if attempt < retries - 1:
                time.sleep(5)
    return None


def soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "lxml")


# ── Alliance map ──────────────────────────────────────────────────────────────

def load_alliance_map() -> dict:
    path = Path(__file__).parent / "party_alliance_map.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


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
    "ALL INDIA UNITED DEMOCRATIC FRONT":   "AIUDF",
    "BODOLAND PEOPLES FRONT":              "BPF",
    "BODOLAND PEOPLE'S FRONT":             "BPF",
    "ASOM GANA PARISHAD":                  "AGP",
    "UNITED PEOPLES PARTY LIBERAL":        "UPPL",
    "INDIAN UNION MUSLIM LEAGUE":          "IUML",
    "KERALA CONGRESS":                     "KC",
    "KERALA CONGRESS (M)":                 "KC(M)",
    "NATIONALIST CONGRESS PARTY":          "NCP",
    "TAMILAGA VETTRI KAZHAGAM":            "TVK",
    "NAAM TAMILAR KATCHI":                 "NTK",
    "PATTALI MAKKAL KATCHI":               "PMK",
    "VIDUTHALAI CHIRUTHAIGAL KATCHI":      "VCK",
    "ALL INDIA FORWARD BLOC":              "AIFB",
    "REVOLUTIONARY SOCIALIST PARTY":       "RSP",
    "TRINAMOOL CONGRESS":                  "TMC",
}


def normalize_party(raw: str) -> str:
    cleaned = re.sub(r"\s+", " ", raw.strip().upper())
    return _NORM_MAP.get(cleaned, raw.strip())


# ── State summary page — discover AC names ────────────────────────────────────

def get_ac_names(state_code: str) -> dict[int, dict]:
    """
    Fetch partywiseresult-{CODE}.htm to get constituency names and districts.
    Returns {ac_num: {"name": str, "district": str}}.
    """
    url = f"{BASE_URL}/partywiseresult-{state_code}.htm"
    print(f"  Fetching AC list from {url} …")
    html = fetch_html(url, extra_wait=1)
    if not html:
        print(f"  [WARN] Could not fetch AC list — will use numbered names")
        return {}

    bs = soup(html)
    info: dict[int, dict] = {}

    for table in bs.find_all("table"):
        for row in table.find_all("tr"):
            cells = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            if len(cells) >= 2 and cells[0].isdigit():
                num = int(cells[0])
                name = cells[1] if len(cells) > 1 else f"AC {num}"
                district = cells[2] if len(cells) > 2 else ""
                info[num] = {"name": name, "district": district}

    # Also look for links with AC numbers (some pages embed links to each AC)
    for a in bs.find_all("a", href=True):
        href = a["href"]
        m = re.search(r"statewise" + state_code + r"(\d+)", href, re.I)
        if m:
            num = int(m.group(1))
            text = a.get_text(strip=True)
            if text and num not in info:
                info[num] = {"name": text, "district": ""}

    print(f"  Found names for {len(info)} ACs")
    return info


# ── Per-constituency page parser ──────────────────────────────────────────────

def parse_ac_page(html: str, alliance_map: dict) -> Optional[dict]:
    """Parse a statewise{CODE}{NUM}.htm page and return candidate data."""
    bs = soup(html)
    tables = bs.find_all("table")
    candidates_table = None

    # Find the table that looks like candidate results
    for table in tables:
        text = " ".join(c.get_text(" ", strip=True).lower() for c in table.find_all(["th", "td"]))
        if ("candidate" in text or "sl" in text) and ("votes" in text or "vote" in text):
            candidates_table = table
            break

    # Fall back: any table with 4+ columns and multiple rows
    if not candidates_table:
        for table in tables:
            rows = table.find_all("tr")
            if len(rows) > 3:
                first_row = rows[0].find_all(["th", "td"])
                if len(first_row) >= 4:
                    candidates_table = table
                    break

    if not candidates_table:
        return None

    rows = candidates_table.find_all("tr")
    col_map: dict[str, int] = {}
    header_row = 0

    for i, row in enumerate(rows):
        cells = [c.get_text(strip=True).lower() for c in row.find_all(["th", "td"])]
        if any("candidate" in c or "party" in c for c in cells):
            for j, c in enumerate(cells):
                if re.search(r"^(sl|sno|s\.?no|#|no)$", c.strip()):
                    col_map["sl"] = j
                elif "candidate" in c and "name" not in col_map:
                    col_map["name"] = j
                elif "party" in c:
                    col_map["party"] = j
                elif "total" in c and "vote" in c:
                    col_map["votes"] = j
                elif "vote" in c and "votes" not in col_map:
                    col_map["votes"] = j
                elif re.search(r"%|pct|percent", c):
                    col_map["pct"] = j
                elif "status" in c or "result" in c or "won" in c:
                    col_map["status"] = j
            header_row = i
            break

    # Default fallback column positions
    defaults = {"sl": 0, "name": 1, "party": 2, "votes": 3, "pct": 4, "status": 5}
    for k, v in defaults.items():
        col_map.setdefault(k, v)

    candidates = []
    for row in rows[header_row + 1:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue

        def cell(idx: int) -> str:
            return cells[idx].get_text(strip=True) if idx < len(cells) else ""

        name = cell(col_map["name"])
        if not name or name.lower() in ("candidate", "total", "grand total", ""):
            continue

        raw_party = cell(col_map["party"])
        votes_raw = re.sub(r"[^0-9]", "", cell(col_map["votes"]))
        votes = int(votes_raw) if votes_raw else 0
        pct_raw = re.sub(r"[^0-9.]", "", cell(col_map["pct"]))
        pct = float(pct_raw) if pct_raw else 0.0

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


# ── Main state scraper ────────────────────────────────────────────────────────

def scrape_state(state_slug: str, state_meta: dict, alliance_map: dict,
                 dry_run: bool = False) -> dict:
    state_code = state_meta["code"]
    state_name = state_meta["name"]
    total_seats = state_meta["total_seats"]

    print(f"\n{'='*60}")
    print(f"Scraping {state_name} ({state_code}) — {total_seats} seats")
    print(f"{'='*60}")

    ac_info = get_ac_names(state_code)

    if dry_run:
        print(f"  [DRY RUN] Would scrape ACs 1–{total_seats}")
        print(f"  [DRY RUN] Sample URLs:")
        for n in range(1, min(4, total_seats + 1)):
            url = f"{BASE_URL}/statewise{state_code}{n}.htm"
            name = ac_info.get(n, {}).get("name", f"AC {n}")
            print(f"    {n:3d}. {name[:40]} -> {url}")
        return build_empty_state(state_slug, state_name, total_seats)

    constituencies = []
    consecutive_misses = 0

    for num in range(1, total_seats + 1):
        name = ac_info.get(num, {}).get("name") or f"AC {num}"
        district = ac_info.get(num, {}).get("district", "")
        url = f"{BASE_URL}/statewise{state_code}{num}.htm"

        print(f"  [{num}/{total_seats}] {name} … ", end="", flush=True)
        html = fetch_html(url)

        if html is None:
            print("no data")
            consecutive_misses += 1
            if consecutive_misses >= 5 and num > 10:
                print(f"  [STOP] 5 consecutive misses — likely at end of results")
                break
            continue

        consecutive_misses = 0
        result = parse_ac_page(html, alliance_map)

        if not result or not result.get("candidates"):
            # Page loaded but no parseable candidate table — try to debug
            print("parse failed")
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
    party_seats = defaultdict(int)
    party_votes = defaultdict(int)
    party_meta: dict = {}
    total_valid = 0

    for c in constituencies:
        w = c["winner"]
        ps = w["partyShort"]
        party_seats[ps] += 1
        party_votes[ps] += w["votes"]
        party_meta.setdefault(ps, {"party": w["party"], "alliance": w["alliance"]})
        total_valid += c["totalVotes"]

    alliance_seats: dict = defaultdict(int)
    alliance_votes: dict = defaultdict(int)

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

    with open(state_dir / "results.json", "w", encoding="utf-8") as f:
        json.dump(data["constituencies"], f, ensure_ascii=False, separators=(",", ":"))

    with open(state_dir / "summary.json", "w", encoding="utf-8") as f:
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
    args = parser.parse_args()

    alliance_map = load_alliance_map()
    print(f"Loaded {len(alliance_map)} alliance mappings")

    states_to_scrape = (
        {args.state: STATES[args.state]} if args.state != "all" else STATES
    )

    # Warm up session with index page
    print("Warming up session…")
    html = fetch_html(f"{BASE_URL}/index.htm", extra_wait=0)
    if html:
        print("  Index page OK")
    else:
        print("  Index page failed — proceeding anyway")

    start = time.time()
    for slug, meta in states_to_scrape.items():
        try:
            data = scrape_state(slug, meta, alliance_map, dry_run=args.dry_run)
        except Exception as e:
            import traceback
            print(f"  [FATAL] {slug}: {e}")
            traceback.print_exc()
            data = build_empty_state(slug, meta["name"], meta["total_seats"])

        if not args.dry_run:
            write_state_data(slug, data)

    update_index_timestamp()
    print(f"\nDone in {time.time()-start:.0f}s")


if __name__ == "__main__":
    main()
