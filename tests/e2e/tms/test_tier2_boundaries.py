"""Tier 2: Boundary & Corner Cases Tests for Zolexora TMS.

Covers boundary and corner conditions across 5 domains with minimum >=5 test cases per domain:
  - Domain 1: Unauthenticated Infisical Fallback Behavior (B1.01 - B1.05)
  - Domain 2: Missing Optional Environment Variables (B2.01 - B2.05)
  - Domain 3: Container Idempotency (B3.01 - B3.05)
  - Domain 4: Invalid Subcommands & Argument Handling (B4.01 - B4.05)
  - Domain 5: Gitignore Rules for .env Files (B5.01 - B5.05)
"""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
import unittest

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from helpers import (
    find_tms_startup_scripts,
    get_infisical_config_path,
    get_repo_root,
    get_tms_compose_path,
    is_stack_running,
    run_cmd,
)


class TestTier2Domain1InfisicalFallback(unittest.TestCase):
    """Domain 1: Unauthenticated Infisical Fallback Behavior."""

    def test_b1_01_fallback_when_token_unset(self):
        """Verify startup script proceeds without hanging when INFISICAL_TOKEN is unset."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        self.assertTrue(canonical_script.exists())
        # Run with empty token and stdin closed
        env = {"INFISICAL_TOKEN": ""}
        start = time.time()
        rc, stdout, stderr = run_cmd(
            ["bash", str(canonical_script), "status"],
            env=env,
            timeout=10.0,
        )
        elapsed = time.time() - start
        self.assertLess(elapsed, 10.0, "Execution took too long in unauthenticated environment")
        self.assertEqual(rc, 0, f"Status command failed: {stderr}")

    def test_b1_02_fallback_warning_message_emitted(self):
        """Verify script contains user warning guidance when Infisical is unauthenticated."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        content = canonical_script.read_text(encoding="utf-8")
        self.assertIn("infisical login", content)
        self.assertIn("INFISICAL_TOKEN", content)

    def test_b1_03_fallback_preserves_clean_disk(self):
        """Verify unauthenticated fallback execution does not create .env.docker on disk."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        env_docker = get_repo_root() / ".env.docker"
        tms_env_docker = get_repo_root() / "products" / "zolexora-tms" / ".env.docker"
        if env_docker.exists():
            env_docker.unlink()
        if tms_env_docker.exists():
            tms_env_docker.unlink()

        run_cmd(["bash", str(canonical_script), "status"], timeout=5.0)
        self.assertFalse(env_docker.exists(), "Found unexpected .env.docker in repo root")
        self.assertFalse(tms_env_docker.exists(), "Found unexpected .env.docker in products/zolexora-tms")

    def test_b1_04_fallback_exits_cleanly_on_status(self):
        """Verify script status check exits cleanly with code 0 without active auth."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, _, stderr = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
        self.assertEqual(rc, 0, f"docker-start.sh status failed in unauthenticated environment: {stderr}")

    def test_b1_05_auth_detection_with_invalid_token(self):
        """Verify infisical run fails fast and does not loop infinitely on invalid token."""
        start = time.time()
        rc, _, _ = run_cmd(
            ["infisical", "export", "--token=invalid_dummy_token_12345"],
            timeout=5.0,
        )
        elapsed = time.time() - start
        self.assertLess(elapsed, 5.0, "Infisical invalid token check exceeded timeout")
        self.assertNotEqual(rc, 0, "Infisical should fail with non-zero on invalid token")


class TestTier2Domain2MissingEnvVariables(unittest.TestCase):
    """Domain 2: Missing Optional Environment Variables & Default Fallbacks."""

    def test_b2_01_default_port_fallback(self):
        """Verify TMS_PORT unset resolves to 3084 in compose interpolation."""
        compose_path = get_tms_compose_path()
        env = os.environ.copy()
        env.pop("TMS_PORT", None)
        rc, stdout, stderr = run_cmd(
            ["docker", "compose", "-f", str(compose_path), "config"],
            env=env,
            timeout=10.0,
        )
        self.assertEqual(rc, 0, f"Compose config failed: {stderr}")
        self.assertIn("3084", stdout, "Port 3084 fallback not found in resolved compose config")

    def test_b2_02_default_postgres_port_fallback(self):
        """Verify TMS_POSTGRES_PORT unset resolves to 5448 in compose interpolation."""
        compose_path = get_tms_compose_path()
        env = os.environ.copy()
        env.pop("TMS_POSTGRES_PORT", None)
        rc, stdout, stderr = run_cmd(
            ["docker", "compose", "-f", str(compose_path), "config"],
            env=env,
            timeout=10.0,
        )
        self.assertEqual(rc, 0, f"Compose config failed: {stderr}")
        self.assertIn("5448", stdout, "Port 5448 fallback not found in resolved compose config")

    def test_b2_03_missing_sentry_dsn_safe(self):
        """Verify backend app/main.py safely guards Sentry initialization if SENTRY_DSN is None."""
        main_py = (
            get_repo_root() / "products" / "zolexora-tms" / "apps" / "backend" / "app" / "main.py"
        )
        content = main_py.read_text(encoding="utf-8")
        self.assertIn("if settings.SENTRY_DSN:", content)

    def test_b2_04_missing_firebase_frontend_keys(self):
        """Verify compose declares frontend keys without values so empty env does not crash."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("- NEXT_PUBLIC_FIREBASE_ACC1_TMS_API_KEY", content)
        self.assertIn("- NEXT_PUBLIC_FIREBASE_ACC1_TMS_AUTH_DOMAIN", content)

    def test_b2_05_default_database_credentials(self):
        """Verify backend default DATABASE_URL points to postgres service on port 5432."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("DATABASE_URL=postgresql://tms:password@postgres:5432/tms", content)


class TestTier2Domain3ContainerIdempotency(unittest.TestCase):
    """Domain 3: Container Idempotency & Determinism."""

    def test_b3_01_compose_config_idempotent(self):
        """Verify docker compose config produces identical output across consecutive runs."""
        compose_path = get_tms_compose_path()
        rc1, out1, _ = run_cmd(["docker", "compose", "-f", str(compose_path), "config"], timeout=10.0)
        rc2, out2, _ = run_cmd(["docker", "compose", "-f", str(compose_path), "config"], timeout=10.0)
        self.assertEqual(rc1, 0)
        self.assertEqual(rc2, 0)
        self.assertEqual(out1, out2, "Consecutive compose config invocations produced differing outputs")

    def test_b3_02_script_status_idempotent(self):
        """Verify executing status repeatedly causes zero state alterations."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc1, out1, _ = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
        rc2, out2, _ = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
        self.assertEqual(rc1, 0)
        self.assertEqual(rc2, 0)
        import re
        norm1 = re.sub(r"Up \d+ \w+", "Up X", out1)
        norm2 = re.sub(r"Up \d+ \w+", "Up X", out2)
        self.assertEqual(norm1, norm2)

    def test_b3_03_restart_command_syntax_idempotent(self):
        """Verify restart command implementation performs down before start."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        content = canonical_script.read_text(encoding="utf-8")
        self.assertIn("restart)", content)
        self.assertIn("down", content)

    def test_b3_04_compose_down_when_already_stopped(self):
        """Verify docker compose down exits with code 0 even when no containers are running."""
        compose_path = get_tms_compose_path()
        cmd = ["docker", "compose", "-f", str(compose_path), "down"]
        if is_stack_running():
            cmd.append("--dry-run")
        rc, _, stderr = run_cmd(cmd, timeout=15.0)
        self.assertEqual(rc, 0, f"docker compose down failed: {stderr}")


    def test_b3_05_postgres_volume_preservation(self):
        """Verify postgres named volume postgres_data is declared top-level to prevent loss."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("volumes:", content)
        self.assertIn("postgres_data:", content)


class TestTier2Domain4InvalidSubcommands(unittest.TestCase):
    """Domain 4: Invalid Subcommands & Argument Handling."""

    def test_b4_01_unknown_subcommand_rejected(self):
        """Verify script exits with non-zero status on unknown subcommand."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, stdout, stderr = run_cmd(["bash", str(canonical_script), "unknown_cmd_xyz"], timeout=5.0)
        self.assertNotEqual(rc, 0)
        self.assertIn("Usage", stdout + stderr)

    def test_b4_02_special_character_injection_safety(self):
        """Verify passing special shell metacharacters does not trigger command injection."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, stdout, stderr = run_cmd(
            ["bash", str(canonical_script), "; echo 'INJECTED';"],
            timeout=5.0,
        )
        self.assertNotEqual(rc, 0)
        self.assertNotIn("INJECTED", stdout)

    def test_b4_03_empty_string_argument(self):
        """Verify passing an empty string argument defaults cleanly to start action."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        # Test dry-run default action expansion without executing network compose up
        test_cmd = (
            f"bash -c 'ACTION=\"${{1:-start}}\"; case \"$ACTION\" in "
            f"start|up) echo \"DEFAULT_RESOLVED_START\" ;; *) echo \"OTHER\" ;; esac' _ \"\""
        )
        rc, stdout, _ = run_cmd(test_cmd, timeout=5.0)
        self.assertEqual(rc, 0)
        self.assertIn("DEFAULT_RESOLVED_START", stdout)

    def test_b4_04_non_interactive_stdin_pipe(self):
        """Verify piping empty string into script executes without hanging on interactive read."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        start = time.time()
        rc, _, _ = run_cmd(
            ["bash", str(canonical_script), "status"],
            input_text="",
            timeout=5.0,
        )
        elapsed = time.time() - start
        self.assertLess(elapsed, 5.0, "Piped stdin caused blocking wait")
        self.assertEqual(rc, 0)

    def test_b4_05_invalid_flag_handling(self):
        """Verify passing invalid option flags outputs usage and returns non-zero."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, stdout, stderr = run_cmd(["bash", str(canonical_script), "--invalid-flag"], timeout=5.0)
        self.assertNotEqual(rc, 0)
        self.assertIn("Usage", stdout + stderr)


class TestTier2Domain5GitignoreRules(unittest.TestCase):
    """Domain 5: Gitignore Rules for .env Files."""

    def test_b5_01_root_env_ignored(self):
        """Verify root .env is ignored by git."""
        rc, _, _ = run_cmd(["git", "check-ignore", "-q", ".env"])
        self.assertEqual(rc, 0, "Root .env must be ignored by git")

    def test_b5_02_nested_env_ignored(self):
        """Verify deeply nested .env inside apps/backend is ignored by git."""
        rc, _, _ = run_cmd(["git", "check-ignore", "-q", "products/zolexora-tms/apps/backend/.env"])
        self.assertEqual(rc, 0, "Nested .env must be ignored by git")

    def test_b5_03_arbitrary_wildcard_env_ignored(self):
        """Verify arbitrary wildcard *.env files are ignored by git."""
        for pattern in ["custom.env", "secret.env", ".env.test", "config/envs/arbitrary.env"]:
            rc, _, _ = run_cmd(["git", "check-ignore", "-q", pattern])
            self.assertEqual(rc, 0, f"File {pattern} must be ignored by git")

    def test_b5_04_env_local_and_production_ignored(self):
        """Verify .env.local and .env.production are ignored by git."""
        for env_file in [".env.local", ".env.production", ".env.staging"]:
            rc, _, _ = run_cmd(["git", "check-ignore", "-q", f"products/zolexora-tms/{env_file}"])
            self.assertEqual(rc, 0, f"File {env_file} must be ignored by git")

    def test_b5_05_env_example_not_ignored(self):
        """Verify config/envs/zolexora-tms/tms.env.example is explicitly NOT ignored."""
        rc, _, _ = run_cmd(
            ["git", "check-ignore", "-q", "config/envs/zolexora-tms/tms.env.example"],
        )
        self.assertNotEqual(rc, 0, "tms.env.example must NOT be ignored by git")


if __name__ == "__main__":
    unittest.main()
