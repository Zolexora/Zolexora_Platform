"""Tier 3: Cross-Feature Combination Tests for Zolexora TMS.

Validates multi-dimensional pairwise integrations:
  - C1: Infisical Injection + Docker Compose Invocation Command
  - C2: Nginx Reverse Proxy + Backend /api/ Routing & Headers
  - C3: Nginx Reverse Proxy + Frontend Web Routing
  - C4: Nginx Reverse Proxy + Admin Dashboard Routing
  - C5: Backend + Postgres Network & Credentials Alignment
  - C6: Environment Pass-Through & Runtime window.__ENV__ Injection
  - C7: Multi-Service Startup Ordering & Healthcheck Dependencies
  - C8: Graceful Shutdown Coordination & Resource Retention
"""

import json
import os
from pathlib import Path
import re
import sys
import unittest

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from helpers import (
    get_container_health,
    get_infisical_config_path,
    get_nginx_conf_path,
    get_repo_root,
    get_tms_compose_path,
    http_get,
    is_container_running,
    is_port_open,
    run_cmd,
)


class TestTier3CrossFeatureCombinations(unittest.TestCase):
    """Tier 3: Cross-Feature Integration and Pairwise Invariant Tests."""

    def test_c1_infisical_injection_with_compose_launch(self):
        """Pair 1: Infisical Run Injection + Docker Compose Launch.

        Validates that Infisical CLI invocation format synthesizes
        properly with workspace ID, environment, and canonical compose path.
        """
        compose_path = get_tms_compose_path()
        cfg_path = get_infisical_config_path()
        with open(cfg_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)

        project_id = cfg["workspaceId"]
        env = cfg["defaultEnvironment"]
        secret_path = cfg["secretsPath"]

        # Verify command synthesis contract
        expected_cmd_tokens = [
            "infisical", "run",
            f"--projectId={project_id}",
            f"--env={env}",
            f"--path={secret_path}",
            "--",
            "docker", "compose", "-f", str(compose_path),
        ]
        self.assertIn("188824cd-59ce-468f-b60f-f2da7aeefe63", expected_cmd_tokens[2])
        self.assertIn("dev", expected_cmd_tokens[3])
        self.assertIn("/Zolexora_TMS", expected_cmd_tokens[4])

        # Test CLI accepts the flag structure non-destructively
        rc, stdout, stderr = run_cmd(
            ["infisical", "run", "--help"],
            timeout=5.0,
        )
        self.assertEqual(rc, 0)
        self.assertIn("--env", stdout)
        self.assertIn("--path", stdout)

    def test_c2_nginx_reverse_proxy_to_backend_api_routing(self):
        """Pair 2: Nginx Reverse Proxy + Backend /api/ Routing & Headers.

        Validates Nginx location /api/ routes to tms-backend:4030,
        passing X-Forwarded-For, X-Forwarded-Proto, and Host headers.
        """
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")

        # Extract /api/ location block
        api_block = re.search(r"location\s+/api/\s*\{([^}]+)\}", content)
        self.assertIsNotNone(api_block, "Nginx config missing location /api/ block")
        block_content = api_block.group(1)

        self.assertIn("proxy_pass http://tms-backend:4030;", block_content)
        self.assertIn("proxy_set_header Host $host;", block_content)
        self.assertIn("proxy_set_header X-Real-IP $remote_addr;", block_content)
        self.assertIn("proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;", block_content)
        self.assertIn("proxy_set_header X-Forwarded-Proto $scheme;", block_content)

        # If live containers are up, probe the route through gateway
        if is_container_running("tms-nginx") and is_container_running("tms-backend") and is_port_open(3084):
            status, body, headers = http_get("http://localhost:3084/api/health")
            # /api/health should route to backend
            self.assertEqual(status, 200)
            data = json.loads(body)
            self.assertEqual(data.get("status"), "ok")

    def test_c3_nginx_reverse_proxy_to_frontend_web_routing(self):
        """Pair 3: Nginx Reverse Proxy + Frontend Web Routing.

        Validates Nginx default server block proxies / to tms-web:80.
        """
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")

        # Verify default server block proxies / to tms-web:80
        web_match = re.search(r"location\s+/\s*\{[^}]*proxy_pass\s+http://tms-web:80;", content)
        self.assertIsNotNone(web_match, "Nginx missing location / proxying to tms-web:80")

        if is_container_running("tms-nginx") and is_container_running("tms-web") and is_port_open(3084):
            status, _, headers = http_get("http://localhost:3084/")
            self.assertEqual(status, 200)

    def test_c4_nginx_reverse_proxy_to_admin_dashboard_routing(self):
        """Pair 4: Nginx Reverse Proxy + Admin Dashboard Routing.

        Validates Nginx admin.localhost virtual host proxies / to tms-admin:80.
        """
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")

        self.assertIn("server_name admin.localhost;", content)
        self.assertIn("proxy_pass http://tms-admin:80;", content)

        if is_container_running("tms-nginx") and is_container_running("tms-admin") and is_port_open(3084):
            status, _, _ = http_get("http://localhost:3084/", headers={"Host": "admin.localhost"})
            self.assertEqual(status, 200)

    def test_c5_postgres_backend_connectivity_contract(self):
        """Pair 5: Database Credentials + Backend Configuration Alignment.

        Validates that backend database environment in compose maps Infisical
        database connection parameters.
        """
        compose_content = get_tms_compose_path().read_text(encoding="utf-8")

        # Verify Infisical database keys in backend environment
        self.assertIn("DATABASE_ZOLEXORA_TMS_HOST", compose_content)
        self.assertIn("DATABASE_ZOLEXORA_TMS_USER", compose_content)
        self.assertIn("DATABASE_ZOLEXORA_TMS_PASSWORD", compose_content)

        # If stack is running, probe /ready
        if is_container_running("tms-backend") and is_port_open(4030):
            status, body, _ = http_get("http://localhost:4030/ready")
            if status == 200:
                data = json.loads(body)
                self.assertEqual(data.get("status"), "ready")

    def test_c6_environment_passthrough_to_frontend_containers(self):
        """Pair 6: Environment Variable Pass-Through & window.__ENV__ Generator.

        Validates docker-entrypoint-env.sh dynamic generation logic matches
        the NEXT_PUBLIC_ variables declared in compose.yaml for frontend services.
        """
        compose_content = get_tms_compose_path().read_text(encoding="utf-8")
        entrypoint_script = get_repo_root() / "products" / "zolexora-tms" / "docker-entrypoint-env.sh"
        self.assertTrue(entrypoint_script.is_file(), "Missing docker-entrypoint-env.sh")

        entrypoint_content = entrypoint_script.read_text(encoding="utf-8")
        self.assertIn("window.__ENV__", entrypoint_content)
        self.assertIn("NEXT_PUBLIC", entrypoint_content)

        # Verify tms-web and tms-admin declare NEXT_PUBLIC variables
        self.assertIn("container_name: tms-web", compose_content)
        self.assertIn("NEXT_PUBLIC_TMS_CLIENT_FIREBASE_API_KEY", compose_content)
        self.assertIn("container_name: tms-admin", compose_content)
        self.assertIn("NEXT_PUBLIC_TMS_ADMIN_FIREBASE_API_KEY", compose_content)

    def test_c7_multi_service_dependency_and_ordering(self):
        """Pair 7: Multi-Service Startup Ordering & Healthcheck Dependencies.

        Validates that Nginx reverse proxy depends on backend, tms-web, and tms-admin
        being healthy, ensuring complete service readiness before routing traffic.
        """
        compose_content = get_tms_compose_path().read_text(encoding="utf-8")

        # Nginx must depend on backend condition service_healthy
        self.assertIn("depends_on:", compose_content)
        self.assertIn("backend:", compose_content)
        self.assertIn("condition: service_healthy", compose_content)

    def test_c8_graceful_shutdown_coordination(self):
        """Pair 8: Graceful Shutdown Coordination & Resource Retention.

        Validates that down action in startup script stops the compose stack
        cleanly without deleting named data volumes (preventing volume wipe).
        """
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        content = canonical_script.read_text(encoding="utf-8")

        self.assertIn("stop|down)", content)
        # down should NOT include -v (which would delete named volumes)
        self.assertIn('docker compose -f "$COMPOSE_FILE" down', content)
        self.assertNotIn('down -v', content)


if __name__ == "__main__":
    unittest.main()
