"""The throwaway test database (tests/postgres-test.compose.yml), migrated to head once per run."""

import os
import subprocess
import sys
from pathlib import Path

API = Path(__file__).parents[1]
COMPOSE = Path(__file__).with_name("postgres-test.compose.yml")
PORT = os.environ.get("MARKETPLACE_TEST_POSTGRES_PORT", "5434")
TEST_URL = f"postgresql://marketplace_local:marketplace-local-only@127.0.0.1:{PORT}/marketplace_local"

_ready = False


def start_database() -> None:
    subprocess.run(["docker", "compose", "-f", str(COMPOSE), "up", "-d", "--wait"], check=True, capture_output=True)


def ensure_database() -> str:
    """Starts the test database and migrates it to head (once per test run)."""
    global _ready
    if not _ready:
        start_database()
        subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=API, check=True,
                       env={**os.environ, "DATABASE_URL": TEST_URL})
        _ready = True
    return TEST_URL


def reset_marker() -> None:
    """Call after a test drops the schema, so the next ensure_database() migrates again."""
    global _ready
    _ready = False
