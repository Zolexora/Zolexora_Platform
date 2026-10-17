"""Pytest fixtures and configuration for Zolexora TMS E2E tests."""

import pytest
from pathlib import Path
import sys

# Ensure tests/e2e/tms is on PYTHONPATH
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from helpers import (
    get_repo_root,
    get_tms_compose_path,
    get_infisical_config_path,
    is_stack_running,
)


@pytest.fixture(scope="session")
def repo_root():
    return get_repo_root()


@pytest.fixture(scope="session")
def compose_path():
    return get_tms_compose_path()


@pytest.fixture(scope="session")
def infisical_config():
    return get_infisical_config_path()


@pytest.fixture(scope="session")
def stack_active():
    return is_stack_running()
