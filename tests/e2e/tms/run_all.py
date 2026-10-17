#!/usr/bin/env python3
"""Automated E2E Test Suite Runner for Zolexora TMS.

Executes tests across all 4 tiers with structured reporting:
  - Tier 1: Feature Coverage (40 tests across 8 features)
  - Tier 2: Boundary & Corner Cases (25 tests across 5 domains)
  - Tier 3: Cross-Feature Combinations (8 integration tests)
  - Tier 4: Real-World Scenarios (5 workload scenarios)

Usage:
  python3 tests/e2e/tms/run_all.py [--tier 1|2|3|4] [-v] [--json]
"""

import argparse
import json
import os
from pathlib import Path
import sys
import time
import unittest

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

# Colors for terminal output
CYAN = "\033[0;36m"
BLUE = "\033[0;34m"
GREEN = "\033[0;32m"
RED = "\033[0;31m"
YELLOW = "\033[1;33m"
BOLD = "\033[1m"
RESET = "\033[0m"

TIER_MODULES = [
    {
        "tier": 1,
        "name": "Tier 1: Feature Coverage",
        "description": "Primary requirements & happy paths (8 features, >=5 tests each)",
        "module": "test_tier1_features",
    },
    {
        "tier": 2,
        "name": "Tier 2: Boundary & Corner Cases",
        "description": "Unauthenticated fallbacks, defaults, idempotency, gitignore",
        "module": "test_tier2_boundaries",
    },
    {
        "tier": 3,
        "name": "Tier 3: Cross-Feature Combinations",
        "description": "Pairwise integration (Infisical, Nginx, Backend, Postgres, Frontend)",
        "module": "test_tier3_combinations",
    },
    {
        "tier": 4,
        "name": "Tier 4: Real-World Scenarios",
        "description": "Realistic workloads (lifecycle, multi-tenant traffic, zero-leak secrets)",
        "module": "test_tier4_workloads",
    },
    {
        "tier": 5,
        "name": "Tier 5: Adversarial Security & Robustness",
        "description": "Host injection, unsupported methods, traversal, large payloads, connection saturation",
        "module": "test_tier5_security",
    },
]


def print_banner():
    print(f"{CYAN}{BOLD}")
    print("╔══════════════════════════════════════════════════════════════════════════════╗")
    print("║            ZOLEXORA TMS — 4-TIER E2E TEST SUITE RUNNER                       ║")
    print("║        Requirement-Driven • Opaque-Box • Docker & Infisical Architecture     ║")
    print("╚══════════════════════════════════════════════════════════════════════════════╝")
    print(f"{RESET}")


import io

def run_tier(tier_info: dict, verbose: bool = False, quiet: bool = False) -> dict:
    module_name = tier_info["module"]
    tier_name = tier_info["name"]
    if not quiet:
        print(f"\n{BLUE}{BOLD}▶ Executing {tier_name}...{RESET}")
        print(f"  {CYAN}{tier_info['description']}{RESET}")

    loader = unittest.TestLoader()
    suite = loader.loadTestsFromName(module_name)
    stream = io.StringIO() if quiet else sys.stderr
    runner = unittest.TextTestRunner(stream=stream, verbosity=2 if verbose else 1)

    start_time = time.time()
    result = runner.run(suite)
    elapsed = time.time() - start_time

    total_tests = result.testsRun
    failed_tests = len(result.failures) + len(result.errors)
    passed_tests = total_tests - failed_tests
    success = result.wasSuccessful()

    if not quiet:
        status_str = f"{GREEN}✓ PASSED{RESET}" if success else f"{RED}✕ FAILED{RESET}"
        print(f"  Result: {status_str} ({passed_tests}/{total_tests} passed in {elapsed:.2f}s)")

    return {
        "tier": tier_info["tier"],
        "name": tier_name,
        "total": total_tests,
        "passed": passed_tests,
        "failed": failed_tests,
        "success": success,
        "duration_seconds": round(elapsed, 3),
        "failures": [str(f[0]) for f in result.failures],
        "errors": [str(e[0]) for e in result.errors],
    }


def main():
    parser = argparse.ArgumentParser(description="Zolexora TMS E2E Test Suite Runner")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4, 5], help="Run only specific tier")
    parser.add_argument("-v", "--verbose", action="store_true", help="Verbose test execution")
    parser.add_argument("--json", action="store_true", help="Output summary in JSON format")
    args = parser.parse_args()

    if not args.json:
        print_banner()

    tiers_to_run = TIER_MODULES
    if args.tier:
        tiers_to_run = [t for t in TIER_MODULES if t["tier"] == args.tier]

    overall_start = time.time()
    tier_results = []
    all_success = True

    for tier_info in tiers_to_run:
        res = run_tier(tier_info, verbose=args.verbose, quiet=args.json)
        tier_results.append(res)
        if not res["success"]:
            all_success = False

    overall_duration = round(time.time() - overall_start, 3)
    total_count = sum(r["total"] for r in tier_results)
    passed_count = sum(r["passed"] for r in tier_results)
    failed_count = sum(r["failed"] for r in tier_results)

    if args.json:
        summary_payload = {
            "success": all_success,
            "total": total_count,
            "passed": passed_count,
            "failed": failed_count,
            "duration_seconds": overall_duration,
            "tiers": tier_results,
        }
        print(json.dumps(summary_payload, indent=2))
    else:
        print(f"\n{CYAN}{BOLD}══════════════════════════════════════════════════════════════════════════════{RESET}")
        print(f"{BOLD}                        E2E TEST SUITE SUMMARY REPORT                         {RESET}")
        print(f"{CYAN}{BOLD}══════════════════════════════════════════════════════════════════════════════{RESET}")
        for r in tier_results:
            tier_status = f"{GREEN}PASSED{RESET}" if r["success"] else f"{RED}FAILED{RESET}"
            print(f"  {BOLD}{r['name']:<40}{RESET} : [{tier_status}] {r['passed']}/{r['total']} ({r['duration_seconds']}s)")
        print(f"{CYAN}──────────────────────────────────────────────────────────────────────────────{RESET}")
        print(f"  {BOLD}Total Test Cases   :{RESET} {total_count}")
        print(f"  {BOLD}Passed Tests       :{RESET} {GREEN if failed_count == 0 else YELLOW}{passed_count}{RESET}")
        print(f"  {BOLD}Failed Tests       :{RESET} {RED if failed_count > 0 else GREEN}{failed_count}{RESET}")
        print(f"  {BOLD}Total Execution    :{RESET} {overall_duration}s")
        print(f"{CYAN}{BOLD}══════════════════════════════════════════════════════════════════════════════{RESET}")

        if all_success:
            print(f"\n{GREEN}{BOLD}🎉 ALL {total_count} E2E TESTS PASSED SUCCESSFULLY! (Exit Code: 0){RESET}\n")
        else:
            print(f"\n{RED}{BOLD}❌ E2E TEST SUITE FAILED WITH {failed_count} FAILURES!{RESET}\n")

    sys.exit(0 if all_success else 1)


if __name__ == "__main__":
    main()
