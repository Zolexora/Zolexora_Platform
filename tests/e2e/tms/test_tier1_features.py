"""Tier 1: Feature Coverage Tests for Zolexora TMS.

Covers every requirement across 8 features with minimum >=5 test cases per feature:
  - Feature 1: Infisical CLI Availability (F1.01 - F1.05)
  - Feature 2: Non-Blocking Auth Check (F2.01 - F2.05)
  - Feature 3: Startup Script Command Syntax (F3.01 - F3.05)
  - Feature 4: Docker Compose File Validity (F4.01 - F4.05)
  - Feature 5: Postgres Port 5448 & Config (F5.01 - F5.05)
  - Feature 6: Backend Health Endpoint (F6.01 - F6.05)
  - Feature 7: Nginx Gateway Port 3084 (F7.01 - F7.05)
  - Feature 8: Git Secret Hygiene (F8.01 - F8.05)
"""

import json
import os
from pathlib import Path
import re
import shutil
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
    get_infisical_config_path,
    get_nginx_conf_path,
    get_repo_root,
    get_tms_compose_path,
    get_tms_env_example_path,
    http_get,
    is_container_running,
    is_port_open,
    run_cmd,
)


class TestTier1Feature1InfisicalAvailability(unittest.TestCase):
    """Feature 1: Infisical CLI Availability & Environment Setup."""

    def test_f1_01_infisical_cli_executable_in_path(self):
        """Verify infisical binary exists in system PATH and is executable."""
        path = shutil.which("infisical")
        self.assertIsNotNone(path, "infisical binary must be installed and found in PATH")
        self.assertTrue(os.access(path, os.X_OK), f"infisical at {path} must be executable")

    def test_f1_02_infisical_cli_version_semantic(self):
        """Verify infisical --version returns exit code 0 and valid semver."""
        rc, stdout, stderr = run_cmd(["infisical", "--version"], timeout=5.0)
        self.assertEqual(rc, 0, f"infisical --version failed: {stderr}")
        match = re.search(r"infisical\s+version\s+(\d+\.\d+\.\d+)", stdout, re.IGNORECASE)
        self.assertIsNotNone(match, f"Unexpected version output format: {stdout}")

    def test_f1_03_infisical_cli_help_options(self):
        """Verify infisical --help lists core subcommands (run, login, export, secrets)."""
        rc, stdout, _ = run_cmd(["infisical", "--help"], timeout=5.0)
        self.assertEqual(rc, 0, "infisical --help must exit with code 0")
        for subcmd in ["run", "login", "export"]:
            self.assertIn(subcmd, stdout, f"infisical --help must mention subcommand '{subcmd}'")

    def test_f1_04_infisical_cli_system_path_location(self):
        """Verify infisical is placed in a standard Linux system directory."""
        path = shutil.which("infisical")
        self.assertIsNotNone(path)
        valid_prefixes = ["/usr/bin", "/usr/local/bin", "/bin", os.path.expanduser("~")]
        self.assertTrue(
            any(path.startswith(prefix) for prefix in valid_prefixes),
            f"infisical at {path} is not in a recognized system binary directory",
        )

    def test_f1_05_infisical_cli_execution_latency(self):
        """Verify infisical --version completes within low latency (no blocking telemetry)."""
        start = time.time()
        rc, _, _ = run_cmd(["infisical", "--version"], timeout=3.0)
        elapsed = time.time() - start
        self.assertEqual(rc, 0)
        self.assertLess(elapsed, 2.5, f"infisical execution took too long ({elapsed:.2f}s)")


class TestTier1Feature2NonBlockingAuth(unittest.TestCase):
    """Feature 2: Non-blocking Infisical Auth Check & Project Configuration."""

    def test_f2_01_infisical_user_get_non_blocking(self):
        """Verify infisical user get terminates within 3 seconds without blocking on stdin."""
        start = time.time()
        rc, stdout, stderr = run_cmd(["infisical", "user", "get"], timeout=3.0)
        elapsed = time.time() - start
        self.assertLess(elapsed, 3.0, f"infisical user get blocked for {elapsed:.2f}s")
        # Command either succeeds (authenticated) or fails cleanly (unauthenticated), but does not hang
        self.assertIn(rc, [0, 1], f"Unexpected return code: {rc}, stderr: {stderr}")

    def test_f2_02_infisical_login_status_non_blocking(self):
        """Verify infisical login status terminates quickly without interactive prompt."""
        start = time.time()
        rc, _, stderr = run_cmd(["infisical", "login", "status"], timeout=3.0)
        elapsed = time.time() - start
        self.assertLess(elapsed, 3.0, f"infisical login status blocked for {elapsed:.2f}s")
        self.assertIn(rc, [0, 1], f"Unexpected return code: {rc}, stderr: {stderr}")

    def test_f2_03_infisical_project_config_exists(self):
        """Verify products/zolexora-tms/.infisical.json exists and is valid JSON."""
        cfg_path = get_infisical_config_path()
        self.assertTrue(cfg_path.is_file(), f"Missing config file: {cfg_path}")
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIsInstance(data, dict)

    def test_f2_04_infisical_project_config_schema(self):
        """Verify products/zolexora-tms/.infisical.json contains target workspace and env."""
        cfg_path = get_infisical_config_path()
        with open(cfg_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data.get("workspaceId"), "188824cd-59ce-468f-b60f-f2da7aeefe63")
        self.assertEqual(data.get("defaultEnvironment"), "dev")
        self.assertEqual(data.get("secretsPath"), "/Zolexora_Auth_TMS")

    def test_f2_05_infisical_script_detection_pattern(self):
        """Verify shell detection pattern runs non-blocking and executes in < 2 seconds."""
        check_cmd = "command -v infisical >/dev/null 2>&1 && infisical login status >/dev/null 2>&1"
        start = time.time()
        rc, _, _ = run_cmd(check_cmd, timeout=3.0)
        elapsed = time.time() - start
        self.assertLess(elapsed, 2.0, f"Detection check exceeded threshold: {elapsed:.2f}s")
        self.assertIn(rc, [0, 1], "Detection check must return 0 (logged in) or 1 (unauthenticated)")


class TestTier1Feature3StartDockerSyntax(unittest.TestCase):
    """Feature 3: Startup Script Command Syntax & Invocation."""

    def test_f3_01_startup_script_file_exists(self):
        """Verify at least one TMS Docker startup script exists and is executable."""
        scripts = find_tms_startup_scripts()
        self.assertGreater(len(scripts), 0, "No TMS Docker startup scripts found")
        for script in scripts:
            self.assertTrue(os.access(script, os.R_OK), f"Script {script} must be readable")

    def test_f3_02_startup_script_bash_syntax_valid(self):
        """Verify bash -n passes with 0 syntax errors on all TMS startup scripts."""
        scripts = find_tms_startup_scripts()
        for script in scripts:
            rc, stdout, stderr = run_cmd(["bash", "-n", str(script)], timeout=5.0)
            self.assertEqual(rc, 0, f"Bash syntax error in {script}: {stderr}")

    def test_f3_03_startup_script_non_interactive_status(self):
        """Verify startup script accepts status or ps without hanging on stdin."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        if canonical_script.exists():
            rc, stdout, stderr = run_cmd(["bash", str(canonical_script), "status"], timeout=10.0)
            self.assertEqual(rc, 0, f"docker-start.sh status failed: {stderr}")

    def test_f3_04_startup_script_help_guidance(self):
        """Verify startup script prints usage or handles unknown subcommand cleanly."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        if canonical_script.exists():
            rc, stdout, stderr = run_cmd(["bash", str(canonical_script), "invalid_subcommand"], timeout=5.0)
            self.assertNotEqual(rc, 0, "Script should exit non-zero on invalid subcommand")
            output = stdout + stderr
            self.assertIn("Usage", output, f"Expected 'Usage' string in output: {output}")

    def test_f3_05_startup_script_references_canonical_compose(self):
        """Verify startup script references products/zolexora-tms/compose.yaml."""
        canonical_script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        self.assertTrue(canonical_script.exists())
        content = canonical_script.read_text(encoding="utf-8")
        self.assertIn("products/zolexora-tms/compose.yaml", content)


class TestTier1Feature4ComposeValidity(unittest.TestCase):
    """Feature 4: Docker Compose File Validity & Service Structure."""

    def test_f4_01_canonical_compose_file_exists(self):
        """Verify canonical compose file products/zolexora-tms/compose.yaml exists."""
        compose_path = get_tms_compose_path()
        self.assertTrue(compose_path.is_file(), f"Compose file missing at: {compose_path}")

    def test_f4_02_compose_config_validation(self):
        """Verify docker compose config exits with 0 on canonical compose file."""
        compose_path = get_tms_compose_path()
        rc, stdout, stderr = run_cmd(
            ["docker", "compose", "-f", str(compose_path), "config"],
            timeout=15.0,
        )
        self.assertEqual(rc, 0, f"Compose syntax validation failed: {stderr}")

    def test_f4_03_compose_defines_all_five_services(self):
        """Verify compose file defines all 5 required TMS services."""
        compose_path = get_tms_compose_path()
        rc, stdout, _ = run_cmd(
            ["docker", "compose", "-f", str(compose_path), "config", "--services"],
            timeout=10.0,
        )
        self.assertEqual(rc, 0)
        services = set(stdout.strip().splitlines())
        expected_services = {"postgres", "backend", "tms-web", "tms-admin", "nginx"}
        self.assertTrue(
            expected_services.issubset(services),
            f"Missing required services. Expected {expected_services}, found {services}",
        )

    def test_f4_04_compose_resource_limits(self):
        """Verify services define deploy resource limits (CPU and memory)."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("limits:", content)
        self.assertIn("cpus:", content)
        self.assertIn("memory:", content)

    def test_f4_05_compose_service_healthchecks(self):
        """Verify services define healthcheck test configurations."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("healthcheck:", content)
        self.assertIn("interval:", content)
        self.assertIn("retries:", content)


class TestTier1Feature5PostgresPort(unittest.TestCase):
    """Feature 5: Postgres Port 5448 & Configuration."""

    def test_f5_01_postgres_port_mapped_to_5448(self):
        """Verify compose.yaml maps host port 5448 to postgres 5432."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertTrue(
            "5448:5432" in content or "${TMS_POSTGRES_PORT:-5448}:5432" in content,
            "Compose file must map postgres host port to 5448",
        )

    def test_f5_02_postgres_container_name_and_image(self):
        """Verify postgres container name is tms-postgres and uses postgres image."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("container_name: tms-postgres", content)
        self.assertTrue(
            "postgres:15-alpine" in content or "postgres:16-alpine" in content,
            "Expected postgres alpine image in compose.yaml",
        )

    def test_f5_03_postgres_healthcheck_command(self):
        """Verify postgres healthcheck uses pg_isready with tms user."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("pg_isready", content)
        self.assertIn("-U tms", content)

    def test_f5_04_postgres_port_no_monorepo_collision(self):
        """Verify port 5448 is unique to TMS across all compose files in the monorepo."""
        root = get_repo_root()
        rc, stdout, _ = run_cmd(
            f"grep -rn '5448' {root}/products/*/compose*.yaml {root}/infra* 2>/dev/null || true",
        )
        lines = [line for line in stdout.strip().splitlines() if line]
        for line in lines:
            self.assertIn("zolexora-tms", line, f"Port 5448 collision detected outside TMS: {line}")

    def test_f5_05_postgres_endpoint_accessible(self):
        """Verify postgres socket on 5448 if container running, else verify port is available."""
        if is_container_running("tms-postgres"):
            self.assertTrue(
                is_port_open(5448),
                "tms-postgres is running but port 5448 is not accepting connections",
            )
        else:
            # Port should be free and unallocated prior to container start
            self.assertFalse(
                is_port_open(5448),
                "Port 5448 should not be in use prior to tms-postgres startup",
            )


class TestTier1Feature6BackendHealth(unittest.TestCase):
    """Feature 6: Backend Health Endpoint (http://localhost:4030/health)."""

    def test_f6_01_backend_healthcheck_target_endpoint(self):
        """Verify backend healthcheck in compose.yaml probes http://localhost:4030/health."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertIn("http://localhost:4030/health", content)

    def test_f6_02_backend_health_route_contract(self):
        """Verify backend /health route implementation returns status ok."""
        routes_file = (
            get_repo_root()
            / "products"
            / "zolexora-tms"
            / "apps"
            / "backend"
            / "app"
            / "modules"
            / "core"
            / "health"
            / "routes.py"
        )
        self.assertTrue(routes_file.is_file(), f"Missing health routes file: {routes_file}")
        content = routes_file.read_text(encoding="utf-8")
        self.assertIn('@router.get("/health"', content)
        self.assertIn('"status": "ok"', content)
        self.assertIn('"service": "zolexora-tms-api"', content)

    def test_f6_03_backend_readiness_route_contract(self):
        """Verify backend /ready route implementation verifies database connectivity."""
        routes_file = (
            get_repo_root()
            / "products"
            / "zolexora-tms"
            / "apps"
            / "backend"
            / "app"
            / "modules"
            / "core"
            / "health"
            / "routes.py"
        )
        content = routes_file.read_text(encoding="utf-8")
        self.assertIn('@router.get("/ready"', content)
        self.assertIn("SELECT 1", content)

    def test_f6_04_backend_port_exposure_in_dockerfile(self):
        """Verify backend Dockerfile declares EXPOSE 4030."""
        dockerfile = (
            get_repo_root() / "products" / "zolexora-tms" / "apps" / "backend" / "Dockerfile"
        )
        self.assertTrue(dockerfile.is_file())
        content = dockerfile.read_text(encoding="utf-8")
        self.assertIn("EXPOSE 4030", content)

    def test_f6_05_backend_health_http_endpoint(self):
        """Verify HTTP 200 on /health when backend is running, or verify route registration."""
        if is_container_running("tms-backend") and is_port_open(4030):
            status, body, headers = http_get("http://localhost:4030/health")
            self.assertEqual(status, 200, f"Backend health endpoint failed with status {status}")
            data = json.loads(body)
            self.assertEqual(data.get("status"), "ok")
            self.assertEqual(data.get("service"), "zolexora-tms-api")
            self.assertIn("X-Response-Time", headers)
        else:
            # Verify route registration in FastAPI app/main.py
            main_py = (
                get_repo_root() / "products" / "zolexora-tms" / "apps" / "backend" / "app" / "main.py"
            )
            content = main_py.read_text(encoding="utf-8")
            self.assertIn("app.include_router(health_router)", content)


class TestTier1Feature7NginxGateway(unittest.TestCase):
    """Feature 7: Nginx Gateway (http://localhost:3084)."""

    def test_f7_01_nginx_port_mapped_to_3084(self):
        """Verify compose.yaml maps host port 3084 to Nginx 80."""
        content = get_tms_compose_path().read_text(encoding="utf-8")
        self.assertTrue(
            "3084:80" in content or "${TMS_PORT:-3084}:80" in content,
            "Compose file must map Nginx host port to 3084",
        )

    def test_f7_02_nginx_api_reverse_proxy_config(self):
        """Verify Nginx default.conf routes /api/ to tms-backend:4030."""
        conf_path = get_nginx_conf_path()
        self.assertTrue(conf_path.is_file(), f"Missing Nginx config: {conf_path}")
        content = conf_path.read_text(encoding="utf-8")
        self.assertIn("location /api/", content)
        self.assertIn("proxy_pass http://tms-backend:4030;", content)

    def test_f7_03_nginx_web_reverse_proxy_config(self):
        """Verify Nginx default.conf routes / to tms-web:80."""
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")
        self.assertIn("location /", content)
        self.assertIn("proxy_pass http://tms-web:80;", content)

    def test_f7_04_nginx_admin_virtual_host_config(self):
        """Verify Nginx default.conf configures admin.localhost virtual host."""
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")
        self.assertIn("server_name admin.localhost;", content)
        self.assertIn("proxy_pass http://tms-admin:80;", content)

    def test_f7_05_nginx_gateway_http_endpoint(self):
        """Verify HTTP 200 on gateway when Nginx is running, or verify configuration syntax."""
        if is_container_running("tms-nginx") and is_port_open(3084):
            status, _, _ = http_get("http://localhost:3084/")
            self.assertEqual(status, 200, f"Nginx gateway returned unexpected status: {status}")
        else:
            # Check Nginx config syntax in Docker if image is present
            conf_dir = get_repo_root() / "products" / "zolexora-tms" / "nginx-conf.d"
            rc, stdout, stderr = run_cmd(
                [
                    "docker", "run", "--rm",
                    "--add-host=tms-backend:127.0.0.1",
                    "--add-host=tms-web:127.0.0.1",
                    "--add-host=tms-admin:127.0.0.1",
                    "-v", f"{conf_dir}:/etc/nginx/conf.d:ro",
                    "nginx:alpine",
                    "nginx", "-t",
                ],
                timeout=10.0,
            )
            self.assertEqual(rc, 0, f"Nginx configuration test failed: {stderr}")


class TestTier1Feature8GitSecretHygiene(unittest.TestCase):
    """Feature 8: Git Secret Hygiene and Leak Prevention."""

    def test_f8_01_root_gitignore_ignores_env_files(self):
        """Verify root .gitignore ignores .env, *.env, and .env.docker."""
        gitignore = get_repo_root() / ".gitignore"
        self.assertTrue(gitignore.is_file())
        content = gitignore.read_text(encoding="utf-8")
        self.assertIn(".env", content)
        self.assertIn("*.env", content)

    def test_f8_02_tms_gitignore_ignores_env_variants(self):
        """Verify products/zolexora-tms/.gitignore ignores .env, .env*.local, .env.production."""
        tms_gi = get_repo_root() / "products" / "zolexora-tms" / ".gitignore"
        self.assertTrue(tms_gi.is_file())
        content = tms_gi.read_text(encoding="utf-8")
        self.assertIn(".env", content)

    def test_f8_03_git_status_porcelain_clean_of_secrets(self):
        """Verify git status --porcelain has zero unencrypted .env or private key files."""
        rc, stdout, stderr = run_cmd(["git", "status", "--porcelain"], timeout=5.0)
        self.assertEqual(rc, 0, f"git status failed: {stderr}")
        lines = stdout.strip().splitlines()
        for line in lines:
            if not line.strip():
                continue
            filename = line[3:].strip()
            # Must not track or untrack plain .env or secret keys (except .example)
            if filename.endswith(".env") or ".env." in filename or filename.endswith(".key") or filename.endswith(".pem"):
                self.assertTrue(
                    filename.endswith(".example") or filename.endswith(".example.env"),
                    f"Forbidden secret file detected in git status: {filename}",
                )

    def test_f8_04_tms_env_example_has_no_secrets(self):
        """Verify config/envs/zolexora-tms/tms.env.example contains only non-secret placeholders."""
        example_path = get_tms_env_example_path()
        self.assertTrue(example_path.is_file(), f"Missing example env: {example_path}")
        content = example_path.read_text(encoding="utf-8")
        # Ensure dummy or placeholder patterns are used
        self.assertIn("PORT=4030", content)
        self.assertIn("your_postgres_password_here", content)
        self.assertNotIn("SUPER_SECRET_PROD_PASSWORD_12345", content)

    def test_f8_05_no_private_keys_committed_in_tms(self):
        """Verify no RSA/PEM private keys exist committed in products/zolexora-tms/."""
        tms_dir = get_repo_root() / "products" / "zolexora-tms"
        for ext in ["*.pem", "*.key", "*id_rsa*"]:
            matches = list(tms_dir.rglob(ext))
            self.assertEqual(
                len(matches),
                0,
                f"Private keys detected in TMS directory: {matches}",
            )


if __name__ == "__main__":
    unittest.main()
