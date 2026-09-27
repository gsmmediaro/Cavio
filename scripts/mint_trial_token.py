"""Mint a signed trial token for the 5-scan clinic pilot."""

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from web.backend.security import mint_trial_token  # noqa: E402


def main() -> None:
    """Parse CLI args and print a trial token."""
    parser = argparse.ArgumentParser(
        description="Create a signed X-Trial-Token for Cavio.",
    )
    parser.add_argument(
        "--clinic",
        required=True,
        help="Clinic id (letters, digits, _ or -)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Token lifetime in days (default 30)",
    )
    args = parser.parse_args()
    secret = os.getenv("TRIAL_TOKEN_SECRET", "").strip()
    if not secret:
        raise SystemExit("TRIAL_TOKEN_SECRET is required")
    token = mint_trial_token(args.clinic, ttl_days=args.days, secret=secret)
    print(token)


if __name__ == "__main__":
    main()
