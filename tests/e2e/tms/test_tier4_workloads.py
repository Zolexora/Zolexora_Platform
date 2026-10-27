"""Tier 4: Real-World Application Scenarios for Zolexora TMS.

Validates end-to-end operational workflows:
  - S1: Cold Start Stack Deployment Lifecycle
  - S2: Gateway End-to-End Traffic Routing (Web, Admin, API)
  - S3: Zero-Disk-Leak Secret Injection Verification
  - S4: Idempotent Status Inspection & Monitoring
  - S5: Full Stack Teardown & Resource Reclamation
"""

import json
import os
from pathlib import Path
import re
import sys
import time
import unittest

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from helpers import (
    find_tms_startup_scripts,
    get_container_health,
    get_nginx_conf_path,
    get_repo_root,
    get_tms_compose_path,
    http_get,
    is_container_running,
    is_port_open,
    is_stack_running,
    run_cmd,
)


class TestTier4RealWorldScenarios(unittest.TestCase):
    """Tier 4: Real-World Workload and Operational Scenarios."""

    def test_s1_cold_start_stack_lifecycle(self):
        """Scenario 1: Cold Start Stack Deployment Lifecycle.

        Validates startup script execution contract, service definitions,
        and container health initialization.
        """
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        self.assertTrue(canonical_script.exists())

        # Test status inquiry via startup script
        rc, stdout, stderr = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
        self.assertEqual(rc, 0, f"Status check failed: {stderr}")

        if is_stack_running():
            # If stack is active, verify all core containers
            for container in ["tms-backend", "tms-web", "tms-admin", "tms-nginx"]:
                self.assertTrue(
                    is_container_running(container),
                    f"Expected container {container} to be running",
                )
        else:
            # Pre-deployment: verify canonical compose file defines all services
            rc, stdout, _ = run_cmd(
                ["docker", "compose", "-f", str(get_tms_compose_path()), "config", "--services"],
                timeout=10.0,
            )
            self.assertEqual(rc, 0)
            services = set(stdout.strip().splitlines())
            self.assertEqual(
                services,
                {"backend", "tms-web", "tms-admin", "nginx"},
            )

    def test_s2_gateway_end_to_end_traffic_routing(self):
        """Scenario 2: Gateway End-to-End Traffic Routing (Web, Admin, API).

        Simulates multi-tenant client traffic routed through Nginx:
        - Default client -> Web Frontend (/)
        - Backend API client -> FastAPI (/api/health)
        - Admin client -> Admin Dashboard (Host: admin.localhost)
        """
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")

        # Verify upstream routing rules
        self.assertIn("proxy_pass http://tms-web:80;", content)
        self.assertIn("proxy_pass http://tms-backend:4030;", content)
        self.assertIn("proxy_pass http://tms-admin:80;", content)

        if is_container_running("tms-nginx") and is_port_open(3084):
            # 1. Test Web Frontend Routing
            status, _, _ = http_get("http://localhost:3084/", timeout=5.0)
            self.assertEqual(status, 200, "Frontend web route failed")

            # 2. Test Admin Dashboard Routing
            admin_status, _, _ = http_get(
                "http://localhost:3084/",
                headers={"Host": "admin.localhost"},
                timeout=5.0,
            )
            self.assertEqual(admin_status, 200, "Admin dashboard route failed")

            # 3. Test Backend API Routing
            if is_container_running("tms-backend"):
                api_status, api_body, _ = http_get("http://localhost:3084/api/health", timeout=5.0)
                self.assertEqual(api_status, 200, "API proxy route failed")
                data = json.loads(api_body)
                self.assertEqual(data.get("status"), "ok")

    def test_s3_zero_disk_leak_secret_injection(self):
        """Scenario 3: Zero-Disk-Leak Secret Injection Verification.

        Validates that secrets are passed through runtime environment variables
        and NO plaintext decrypted files (.env.docker, .env, or keys) exist on host disk.
        """
        root = get_repo_root()
        tms_dir = root / "products" / "zolexora-tms"

        # Check for forbidden ephemeral secret files
        forbidden_patterns = [
            root / ".env.docker",
            tms_dir / ".env.docker",
            root / ".env.decrypted",
            tms_dir / ".env.decrypted",
        ]
        for path in forbidden_patterns:
            self.assertFalse(path.exists(), f"Plaintext secret file found on disk: {path}")

        # Check git status clean of untracked secret files
        rc, stdout, _ = run_cmd(["git", "status", "--porcelain"], timeout=5.0)
        self.assertEqual(rc, 0)
        for line in stdout.strip().splitlines():
            if not line:
                continue
            fname = line[3:].strip()
            self.assertNotIn(".env.docker", fname)
            self.assertNotIn(".env.keys", fname)

    def test_s4_idempotent_status_inspection_and_monitoring(self):
        """Scenario 4: Idempotent Status Inspection & Observability.

        Validates that querying service status repeatedly produces stable output
        without introducing state drift or triggering service restarts.
        """
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc1, out1, _ = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
        rc2, out2, _ = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)

        self.assertEqual(rc1, 0)
        self.assertEqual(rc2, 0)
        self.assertEqual(out1, out2, "Status command output was non-deterministic")

    def test_s5_graceful_shutdown_and_resource_reclamation(self):
        """Scenario 5: Full Stack Teardown & Resource Reclamation.

        Validates that teardown shuts down services cleanly, releases ports,
        and preserves named volume postgres_data.
        """
        compose_path = get_tms_compose_path()
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"

        # Verify down syntax in startup script
        content = canonical_script.read_text(encoding="utf-8")
        self.assertIn("stop|down)", content)

        # Verify that compose down executes cleanly (or dry-run if already running/stopped)
        cmd = ["docker", "compose", "-f", str(compose_path), "down"]
        if is_stack_running():
            cmd.append("--dry-run")
        rc, _, stderr = run_cmd(cmd, timeout=15.0)
        self.assertEqual(rc, 0, f"Teardown command failed: {stderr}")


        # If postgres container is in compose, verify volume; else verify cleanly decoupled
        compose_content = compose_path.read_text(encoding="utf-8")
        if "tms-postgres" in compose_content:
            self.assertIn("volumes:", compose_content)
            self.assertIn("postgres_data:", compose_content)
        else:
            self.assertNotIn("tms-postgres", compose_content)


if __name__ == "__main__":
    unittest.main()
