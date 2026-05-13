#!/usr/bin/env python3
"""
Validates the scraped JSON data for completeness and consistency.
Run after scrape_eci.py to catch issues before building the dashboard.

Usage:
    python validate_data.py
"""

import json
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "public" / "data"

EXPECTED = {
    "puducherry":  30,
    "west_bengal": 294,
    "assam":       126,
    "kerala":      140,
    "tamil_nadu":  234,
}

ERRORS = []
WARNINGS = []


def error(msg: str) -> None:
    ERRORS.append(msg)
    print(f"  ✗ ERROR: {msg}")


def warn(msg: str) -> None:
    WARNINGS.append(msg)
    print(f"  ⚠ WARN:  {msg}")


def ok(msg: str) -> None:
    print(f"  ✓ OK:    {msg}")


def validate_state(slug: str, expected_seats: int) -> None:
    print(f"\n── {slug.upper()} ──")

    results_path = DATA_DIR / slug / "results.json"
    summary_path = DATA_DIR / slug / "summary.json"

    if not results_path.exists():
        error(f"results.json missing for {slug}")
        return
    if not summary_path.exists():
        error(f"summary.json missing for {slug}")
        return

    with open(results_path, encoding="utf-8") as f:
        constituencies = json.load(f)

    with open(summary_path, encoding="utf-8") as f:
        summary = json.load(f)

    # Seat count
    actual = len(constituencies)
    if actual == 0:
        warn(f"No results yet (expected {expected_seats})")
        return
    if actual < expected_seats:
        warn(f"Only {actual}/{expected_seats} constituencies scraped")
    else:
        ok(f"{actual}/{expected_seats} constituencies")

    # Validate each constituency
    bad_ids = []
    negative_votes = []
    missing_winner = []
    no_candidates = []

    for c in constituencies:
        if not c.get("id"):
            bad_ids.append(c.get("name", "?"))
        if c.get("margin", 0) < 0:
            negative_votes.append(c["id"])
        if not c.get("winner", {}).get("name"):
            missing_winner.append(c.get("id", "?"))
        if not c.get("candidates"):
            no_candidates.append(c.get("id", "?"))

        # Check totalVotes sanity
        if c.get("totalVotes", 0) < 100:
            negative_votes.append(f"{c.get('id')} (totalVotes={c.get('totalVotes')})")

    if bad_ids:
        error(f"Constituencies with missing IDs: {bad_ids[:5]}")
    else:
        ok("All constituencies have IDs")

    if negative_votes:
        error(f"Negative or zero vote counts: {negative_votes[:5]}")
    else:
        ok("All vote counts are positive")

    if missing_winner:
        error(f"Missing winner info: {missing_winner[:5]}")
    else:
        ok("All constituencies have winner")

    if no_candidates:
        warn(f"No candidates data: {no_candidates[:5]}")
    else:
        ok("All constituencies have candidate lists")

    # Check summary totals match results
    total_from_results = actual
    total_from_summary = summary.get("seatsReported", 0)
    if total_from_summary != total_from_results:
        warn(f"Summary seatsReported={total_from_summary} != results count={total_from_results}")
    else:
        ok("Summary seat count matches results")

    # Check for duplicate IDs
    ids = [c["id"] for c in constituencies]
    if len(ids) != len(set(ids)):
        error(f"Duplicate constituency IDs found")
    else:
        ok("No duplicate IDs")

    # Alliance totals
    alliance_total = sum(t["seats"] for t in summary.get("allianceTallies", []))
    if summary.get("allianceTallies") and alliance_total != actual:
        error(f"Alliance seat total ({alliance_total}) != scraped count ({actual})")
    elif summary.get("allianceTallies"):
        ok(f"Alliance seat totals add up ({alliance_total})")


def main() -> None:
    print("=== ECI Data Validation ===\n")

    index_path = DATA_DIR / "index.json"
    if not index_path.exists():
        print("ERROR: index.json not found")
        sys.exit(1)

    with open(index_path) as f:
        index = json.load(f)

    print(f"Last updated: {index.get('lastUpdated', 'unknown')}")

    for slug, expected in EXPECTED.items():
        validate_state(slug, expected)

    print(f"\n{'='*40}")
    print(f"Results: {len(ERRORS)} errors, {len(WARNINGS)} warnings")

    if ERRORS:
        print("\nFailed — fix errors before deploying.")
        sys.exit(1)
    else:
        print("\nAll checks passed!" if not WARNINGS else "Passed with warnings.")


if __name__ == "__main__":
    main()
