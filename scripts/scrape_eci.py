#!/usr/bin/env python3
"""
ECI Election Results Scraper — Assembly Elections May 2026
Scrapes https://results.eci.gov.in/ResultAcGenMay2026/ and outputs static JSON.

Usage:
    cd scripts
    pip install -r requirements.txt
    python scrape_eci.py [--state bihar] [--dry-run]

Output:
    ../public/data/{state}/results.json   — all constituency + candidate data
    ../public/data/{state}/summary.json   — party/alliance seat tallies
    ../public/data/index.json             — updated lastUpdated timestamp
"""

import argparse
import json
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import requests
from bs4 import BeautifulSoup

# ── Config ────────────────────────────────────────────────────────────────────

BASE_URL = "https://results.eci.gov.in/ResultAcGenMay2026"

STATES = {
    "bihar":        {"code": "S02", "name": "Bihar",       "total_seats": 243},
    "west_bengal":  {"code": "S22", "name": "West Bengal", "total_seats": 294},
    "assam":        {"code": "S03", "name": "Assam",       "total_seats": 126},
    "kerala":       {"code": "S11", "name": "Kerala",      "total_seats": 140},
    "tamil_nadu":   {"code": "S21", "name": "Tamil Nadu",  "total_seats": 234},
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Referer": BASE_URL + "/index.htm",
}

RATE_LIMIT = 0.5  # seconds between requests
MAX_RETRIES = 3
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"

# ── Alliance map ──────────────────────────────────────────────────────────────

def load_alliance_map() -> dict:
    path = Path(__file__).parent / "party_alliance_map.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return {k: v for k, v in data.items() if not k.startswith("_")}


# ── HTTP helpers ──────────────────────────────────────────────────────────────

session = requests.Session()
session.headers.update(HEADERS)


def fetch_page(url: str, retries: int = MAX_RETRIES) -> Optional[BeautifulSoup]:
    for attempt in range(retries):
        try:
            time.sleep(RATE_LIMIT)
            resp = session.get(url, timeout=20)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "lxml")
        except Exception as e:
            wait = 2 ** attempt
            print(f"  [retry {attempt+1}/{retries}] {url}: {e} — waiting {wait}s")
            time.sleep(wait)
    print(f"  [FAILED] Could not fetch: {url}")
    return None


# ── Party name normalization ──────────────────────────────────────────────────

_PARTY_NORM_MAP = {
    "COMMUNIST PARTY OF INDIA  (MARXIST)": "CPI(M)",
    "COMMUNIST PARTY OF INDIA (MARXIST)": "CPI(M)",
    "COMMUNIST PARTY OF INDIA(MARXIST)": "CPI(M)",
    "COMMUNIST PARTY OF INDIA (M)": "CPI(M)",
    "COMMUNIST PARTY OF INDIA": "CPI",
    "INDIAN NATIONAL CONGRESS": "INC",
    "BHARATIYA JANATA PARTY": "BJP",
    "ALL INDIA TRINAMOOL CONGRESS": "TMC",
    "AITC": "TMC",
    "DRAVIDA MUNNETRA KAZHAGAM": "DMK",
    "ALL INDIA ANNA DRAVIDA MUNNETRA KAZHAGAM": "AIADMK",
    "JANATA DAL (UNITED)": "JD(U)",
    "JANATA DAL(UNITED)": "JD(U)",
    "RASHTRIYA JANATA DAL": "RJD",
    "BAHUJAN SAMAJ PARTY": "BSP",
    "PEOPLES PARTY OF ARUNACHAL": "PPA",
    "INDEPENDENT": "IND",
    "NONE OF THE ABOVE": "NOTA",
}


def normalize_party_name(raw: str) -> str:
    """Return canonical party short name from raw ECI string."""
    cleaned = raw.strip().upper()
    cleaned = re.sub(r"\s+", " ", cleaned)
    cleaned = cleaned.replace(" ", " ")

    if cleaned in _PARTY_NORM_MAP:
        return _PARTY_NORM_MAP[cleaned]

    # Keep original but clean whitespace
    return raw.strip()


def get_party_short(full_name: str) -> str:
    """Return a short abbreviation — use normalized name if already short."""
    norm = normalize_party_name(full_name)
    # If norm is short (≤10 chars) use it directly
    if len(norm) <= 10:
        return norm
    # Otherwise abbreviate: take first letters of words
    words = norm.split()
    abbr = "".join(w[0] for w in words if w)
    return abbr[:8]


# ── Constituency URL discovery ────────────────────────────────────────────────

def get_constituency_urls(state_slug: str, state_code: str) -> list[dict]:
    """
    Fetches the state result summary page and extracts constituency links.
    Returns list of {number, name, url} dicts.
    """
    # Primary URL pattern (party-wise with constituency links)
    url = f"{BASE_URL}/ConstituencywiseS{state_code.replace('S', '')}.htm"
    soup = fetch_page(url)

    if soup is None:
        # Fallback: try partywise result page
        url = f"{BASE_URL}/partywiseresult-{state_code}.htm"
        soup = fetch_page(url)

    if soup is None:
        print(f"  [ERROR] Could not load state page for {state_slug}")
        return []

    constituencies = []
    links = soup.find_all("a", href=True)

    for link in links:
        href = link["href"]
        # Look for constituency-wise result links
        if re.search(r"constituency|Constituency|AC|ac", href) and href.endswith(".htm"):
            text = link.get_text(strip=True)
            # Try to extract constituency number from href or text
            num_match = re.search(r"(\d+)", href)
            if num_match:
                num = int(num_match.group(1))
                full_url = (
                    href if href.startswith("http") else f"{BASE_URL}/{href.lstrip('/')}"
                )
                constituencies.append({"number": num, "name": text, "url": full_url})

    # Deduplicate by number
    seen = set()
    unique = []
    for c in sorted(constituencies, key=lambda x: x["number"]):
        if c["number"] not in seen:
            seen.add(c["number"])
            unique.append(c)

    return unique


# ── Candidate detail page parser ──────────────────────────────────────────────

def parse_candidate_page(url: str, alliance_map: dict) -> Optional[dict]:
    """
    Parses a single constituency's detailed result page.
    Returns a dict with candidates list, or None on failure.
    """
    soup = fetch_page(url)
    if soup is None:
        return None

    # Find the main results table — ECI pages have a table with candidate rows
    tables = soup.find_all("table")
    candidates_table = None

    for table in tables:
        headers_text = " ".join(
            th.get_text(strip=True).lower()
            for th in table.find_all(["th", "td"])
        )
        if any(
            kw in headers_text
            for kw in ["candidate", "party", "votes", "total votes"]
        ):
            candidates_table = table
            break

    if candidates_table is None:
        return None

    rows = candidates_table.find_all("tr")
    candidates = []
    winner_votes = -1

    # Find header row to identify column positions
    header_row = None
    col_map = {}
    for i, row in enumerate(rows):
        cells = row.find_all(["th", "td"])
        cell_texts = [c.get_text(strip=True).lower() for c in cells]
        if any("candidate" in t or "party" in t for t in cell_texts):
            header_row = i
            for j, text in enumerate(cell_texts):
                if "sl" in text or "#" in text or "no" in text:
                    col_map["sl"] = j
                elif "candidate" in text:
                    col_map["name"] = j
                elif "party" in text:
                    col_map["party"] = j
                elif "total votes" in text or "votes" in text:
                    if "votes" not in col_map:
                        col_map["votes"] = j
                elif "%" in text or "percent" in text:
                    col_map["pct"] = j
                elif "status" in text or "won" in text or "result" in text:
                    col_map["status"] = j
            break

    if not col_map or "name" not in col_map:
        # Fallback: assume positional columns
        col_map = {"sl": 0, "name": 1, "party": 2, "votes": 3, "pct": 4, "status": 5}
        header_row = 0

    start_row = (header_row or 0) + 1

    for row in rows[start_row:]:
        cells = row.find_all(["td", "th"])
        if len(cells) < 3:
            continue

        def cell(idx: int) -> str:
            if idx < len(cells):
                return cells[idx].get_text(strip=True)
            return ""

        name = cell(col_map.get("name", 1))
        if not name or name.lower() in ("candidate", "total", ""):
            continue

        raw_party = cell(col_map.get("party", 2))
        votes_str = re.sub(r"[^0-9]", "", cell(col_map.get("votes", 3)))
        votes = int(votes_str) if votes_str else 0
        pct_str = re.sub(r"[^0-9.]", "", cell(col_map.get("pct", 4)))
        pct = float(pct_str) if pct_str else 0.0
        status_text = cell(col_map.get("status", 5)).lower()

        party_short = normalize_party_name(raw_party) if raw_party else "IND"
        alliance = alliance_map.get(party_short)

        is_winner = "won" in status_text or "winner" in status_text
        if votes > winner_votes:
            winner_votes = votes
            # Mark as likely winner — will validate after sorting

        candidates.append({
            "name": name,
            "party": raw_party.strip() if raw_party else "Independent",
            "partyShort": party_short,
            "alliance": alliance,
            "votes": votes,
            "votePct": pct,
            "isWinner": is_winner,
        })

    if not candidates:
        return None

    # Sort by votes descending
    candidates.sort(key=lambda c: c["votes"], reverse=True)

    # Ensure exactly one winner (highest vote-getter)
    for i, cand in enumerate(candidates):
        cand["isWinner"] = i == 0

    # Recalculate vote percentages if missing
    total_votes = sum(c["votes"] for c in candidates)
    if total_votes > 0:
        for cand in candidates:
            if cand["votePct"] == 0 and cand["votes"] > 0:
                cand["votePct"] = round(cand["votes"] / total_votes * 100, 2)

    return {
        "candidates": candidates,
        "totalVotes": total_votes,
    }


# ── State summary page parser (fallback for constituency names/districts) ─────

def parse_state_summary_page(state_code: str) -> dict[str, dict]:
    """
    Parses the party-wise or constituency-wise summary page for a state.
    Returns a dict keyed by constituency number with name and district info.
    """
    info = {}

    # Try constituency-wise summary
    for url_template in [
        f"{BASE_URL}/ConstituencywiseS{state_code.replace('S','')}.htm",
        f"{BASE_URL}/ConstituencyWiseS{state_code.replace('S','')}.htm",
        f"{BASE_URL}/constwise{state_code.lower()}.htm",
    ]:
        soup = fetch_page(url_template)
        if soup is None:
            continue

        tables = soup.find_all("table")
        for table in tables:
            rows = table.find_all("tr")
            for row in rows:
                cells = row.find_all(["td", "th"])
                if len(cells) < 3:
                    continue
                texts = [c.get_text(strip=True) for c in cells]
                # Look for rows with constituency number + name + district
                if texts[0].isdigit():
                    num = int(texts[0])
                    name = texts[1] if len(texts) > 1 else ""
                    district = texts[2] if len(texts) > 2 else ""
                    if name:
                        info[num] = {"name": name, "district": district}
        if info:
            break

    return info


# ── Main scrape function per state ────────────────────────────────────────────

def scrape_state(state_slug: str, state_meta: dict, alliance_map: dict, dry_run: bool = False) -> dict:
    """
    Scrapes all constituency results for a state.
    Returns the full state data dict.
    """
    state_code = state_meta["code"]
    state_name = state_meta["name"]
    total_seats = state_meta["total_seats"]

    print(f"\n{'='*60}")
    print(f"Scraping {state_name} ({state_code}) — {total_seats} seats")
    print(f"{'='*60}")

    # Step 1: Get state summary info (constituency names + districts)
    print("  Loading state summary page…")
    summary_info = parse_state_summary_page(state_code)
    print(f"  Found {len(summary_info)} constituencies in summary")

    # Step 2: Discover constituency detail URLs
    constituency_urls = get_constituency_urls(state_slug, state_code)
    print(f"  Discovered {len(constituency_urls)} constituency links")

    if not constituency_urls and not summary_info:
        print(f"  [WARN] No constituency data found for {state_name}")
        # Return empty structure
        return build_empty_state(state_slug, state_name, total_seats)

    # If we have summary info but no URLs, build placeholder URLs
    if not constituency_urls:
        for num in sorted(summary_info.keys()):
            info = summary_info[num]
            # Try standard URL pattern
            url = f"{BASE_URL}/CandidateWiseResult-{state_code}-{num}.htm"
            constituency_urls.append({
                "number": num,
                "name": info.get("name", f"Constituency {num}"),
                "url": url,
            })

    # Step 3: Scrape each constituency
    constituencies = []
    total = len(constituency_urls)

    for i, c_info in enumerate(constituency_urls):
        num = c_info["number"]
        name = summary_info.get(num, {}).get("name", c_info.get("name", f"Constituency {num}"))
        district = summary_info.get(num, {}).get("district", "")
        url = c_info["url"]

        print(f"  [{i+1}/{total}] {name} ({num}) … ", end="", flush=True)

        if dry_run:
            print("SKIP (dry-run)")
            continue

        result = parse_candidate_page(url, alliance_map)
        if result is None:
            print(f"FAILED — trying alternate URL")
            # Try alternate URL patterns
            for alt_url in [
                f"{BASE_URL}/CandidateWiseResult-{state_code}-{num:02d}.htm",
                f"{BASE_URL}/CandidateWiseResult{state_code}{num}.htm",
                f"{BASE_URL}/cand{state_code.lower()}{num}.htm",
            ]:
                result = parse_candidate_page(alt_url, alliance_map)
                if result:
                    break

        if result is None or not result.get("candidates"):
            print("SKIPPED (no data)")
            continue

        cands = result["candidates"]
        winner = cands[0]
        runner_up = cands[1] if len(cands) > 1 else cands[0]
        total_votes = result["totalVotes"]
        margin = winner["votes"] - runner_up["votes"]
        margin_pct = round(margin / total_votes * 100, 2) if total_votes > 0 else 0.0

        constituency = {
            "id": f"{state_slug}-{num:03d}",
            "assemblyNumber": num,
            "name": name,
            "state": state_slug,
            "district": district,
            "winner": {k: v for k, v in winner.items()},
            "runnerUp": {k: v for k, v in runner_up.items()},
            "margin": margin,
            "marginPct": margin_pct,
            "totalVotes": total_votes,
            "turnout": None,
            "status": "won",
            "candidates": cands,
        }
        constituencies.append(constituency)
        print(f"OK — {winner['name']} ({winner['partyShort']}) +{margin:,}")

    print(f"\n  Scraped {len(constituencies)}/{total_seats} constituencies for {state_name}")

    # Step 4: Compute summary
    summary = compute_state_summary(
        state_slug, state_name, total_seats, constituencies, alliance_map
    )

    return {"summary": summary, "constituencies": constituencies}


def build_empty_state(state_slug: str, state_name: str, total_seats: int) -> dict:
    return {
        "summary": {
            "state": state_slug,
            "stateName": state_name,
            "totalSeats": total_seats,
            "seatsReported": 0,
            "seatsLeading": 0,
            "seatsWon": 0,
            "majorityMark": total_seats // 2 + 1,
            "lastUpdated": datetime.now(timezone.utc).isoformat(),
            "allianceTallies": [],
            "partyTallies": [],
        },
        "constituencies": [],
    }


def compute_state_summary(
    state_slug: str,
    state_name: str,
    total_seats: int,
    constituencies: list[dict],
    alliance_map: dict,
) -> dict:
    """Aggregate seat and vote counts by party and alliance."""
    from collections import defaultdict

    party_seats = defaultdict(int)
    party_votes = defaultdict(int)
    party_meta = {}
    total_valid_votes = 0

    for c in constituencies:
        w = c["winner"]
        ps = w["partyShort"]
        party_seats[ps] += 1
        party_votes[ps] += w["votes"]
        if ps not in party_meta:
            party_meta[ps] = {"party": w["party"], "alliance": w["alliance"]}
        total_valid_votes += c["totalVotes"]

    # Compute alliance tallies
    alliance_seats = defaultdict(int)
    alliance_votes = defaultdict(int)
    alliance_parties = defaultdict(list)

    for ps, seats in party_seats.items():
        meta = party_meta.get(ps, {})
        alliance = meta.get("alliance") or "Others"
        alliance_seats[alliance] += seats
        alliance_votes[alliance] += party_votes[ps]

    # Build party tally list (sorted by seats)
    party_tallies = []
    for ps, seats in sorted(party_seats.items(), key=lambda x: -x[1]):
        meta = party_meta.get(ps, {})
        alliance = meta.get("alliance") or "Others"
        vote_pct = round(party_votes[ps] / total_valid_votes * 100, 2) if total_valid_votes else 0.0
        party_tallies.append({
            "party": meta.get("party", ps),
            "partyShort": ps,
            "alliance": meta.get("alliance"),
            "seats": seats,
            "totalVotes": party_votes[ps],
            "votePct": vote_pct,
            "color": "#94A3B8",  # placeholder — overridden by frontend color map
        })
        alliance_parties[alliance].append({
            "partyShort": ps,
            "seats": seats,
        })

    # Build alliance tally list (sorted by seats)
    alliance_tallies = []
    for alliance, seats in sorted(alliance_seats.items(), key=lambda x: -x[1]):
        vote_pct = round(alliance_votes[alliance] / total_valid_votes * 100, 2) if total_valid_votes else 0.0
        alliance_tallies.append({
            "alliance": alliance,
            "seats": seats,
            "totalVotes": alliance_votes[alliance],
            "votePct": vote_pct,
            "color": "#94A3B8",  # overridden by frontend
            "parties": alliance_parties[alliance],
        })

    return {
        "state": state_slug,
        "stateName": state_name,
        "totalSeats": total_seats,
        "seatsReported": len(constituencies),
        "seatsLeading": 0,
        "seatsWon": len(constituencies),
        "majorityMark": total_seats // 2 + 1,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
        "allianceTallies": alliance_tallies,
        "partyTallies": party_tallies,
    }


# ── Output ────────────────────────────────────────────────────────────────────

def write_state_data(state_slug: str, data: dict) -> None:
    state_dir = OUTPUT_DIR / state_slug
    state_dir.mkdir(parents=True, exist_ok=True)

    results_path = state_dir / "results.json"
    summary_path = state_dir / "summary.json"

    with open(results_path, "w", encoding="utf-8") as f:
        json.dump(data["constituencies"], f, ensure_ascii=False, separators=(",", ":"))

    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(data["summary"], f, ensure_ascii=False, indent=2)

    print(f"  Written: {results_path} ({len(data['constituencies'])} constituencies)")
    print(f"  Written: {summary_path}")


def update_index_timestamp() -> None:
    index_path = OUTPUT_DIR / "index.json"
    if index_path.exists():
        with open(index_path, encoding="utf-8") as f:
            data = json.load(f)
        data["lastUpdated"] = datetime.now(timezone.utc).isoformat()
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"\n  Updated index.json timestamp")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape ECI election results")
    parser.add_argument(
        "--state",
        choices=list(STATES.keys()) + ["all"],
        default="all",
        help="Which state to scrape (default: all)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Discover URLs but do not fetch constituency pages",
    )
    args = parser.parse_args()

    alliance_map = load_alliance_map()
    print(f"Loaded {len(alliance_map)} party-to-alliance mappings")

    states_to_scrape = (
        {args.state: STATES[args.state]}
        if args.state != "all"
        else STATES
    )

    start = time.time()
    for slug, meta in states_to_scrape.items():
        data = scrape_state(slug, meta, alliance_map, dry_run=args.dry_run)
        if not args.dry_run:
            write_state_data(slug, data)

    update_index_timestamp()
    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.0f}s")


if __name__ == "__main__":
    main()
