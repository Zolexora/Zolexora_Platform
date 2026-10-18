"""Tier 5: Adversarial Coverage Hardening Tests for Zolexora TMS.

Conducts white-box adversarial analysis to verify edge conditions, parameter boundaries,
error handling, and resilience across 7 challenge domains:
  - Domain 1: API Request Tracing, Boundary Headers & Error Handling (ADV1.01 - ADV1.07)
  - Domain 2: Cross-Origin Resource Sharing (CORS) & Origin Security (ADV2.01 - ADV2.04)
  - Domain 3: Nginx Gateway Reverse Proxy Routing & HTTP Hardening (ADV3.01 - ADV3.08)
  - Domain 4: Database Live Health, Wire Protocol & Authentication Isolation (ADV4.01 - ADV4.05)
  - Domain 5: Security Credentials & Unauthenticated Access Control (ADV5.01 - ADV5.04)
  - Domain 6: Environment Passthrough, Dynamic Configuration & Resource Isolation (ADV6.01 - ADV6.06)
  - Domain 7: Advanced Operational Scenarios & Documentation (ADV7.01 - ADV7.04)

Total Test Cases: 38
"""

import concurrent.futures
import json
import os
from pathlib import Path
import re
import socket
import sys
import time
import unittest
import urllib.error
import urllib.request
from typing import Dict, Optional, Tuple

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from helpers import (
    CaseInsensitiveDict,
    get_repo_root,
    get_tms_compose_path,
    is_container_running,
    is_port_open,
    is_stack_running,
    run_cmd,
)


class NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    """HTTP redirect handler that intercepts redirects instead of following."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def http_request(
    url: str,
    method: str = "GET",
    headers: Optional[Dict[str, str]] = None,
    data: Optional[bytes | str] = None,
    timeout: float = 5.0,
    follow_redirects: bool = True,
) -> Tuple[int, str, CaseInsensitiveDict]:
    """Execute an HTTP request and return (status, body, headers)."""
    req_headers = headers or {}
    body_bytes = data.encode("utf-8") if isinstance(data, str) else data
    req = urllib.request.Request(url, data=body_bytes, headers=req_headers, method=method)

    opener = (
        urllib.request.build_opener()
        if follow_redirects
        else urllib.request.build_opener(NoRedirectHandler)
    )

    try:
        with opener.open(req, timeout=timeout) as resp:
            status = resp.status
            body = resp.read().decode("utf-8", errors="replace")
            resp_headers = CaseInsensitiveDict(resp.headers)
            for k in list(resp.headers.keys()):
                canonical = "-".join(p.capitalize() for p in k.split("-"))
                resp_headers[canonical] = resp.headers[k]
            return status, body, resp_headers
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        resp_headers = CaseInsensitiveDict(err.headers)
        for k in list(err.headers.keys()):
            canonical = "-".join(p.capitalize() for p in k.split("-"))
            resp_headers[canonical] = err.headers[k]
        return err.code, body, resp_headers
    except Exception as exc:
        return -1, str(exc), CaseInsensitiveDict()


class TestTier5Domain1ApiHeaderTracing(unittest.TestCase):
    """Domain 1: API Request Tracing, Boundary Headers & Error Handling."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_01_custom_correlation_id_passthrough(self):
        """Verify custom X-Request-ID is preserved and reflected back verbatim."""
        custom_id = "zolexora-trace-adv-9999"
        status, body, headers = http_request(
            "http://localhost:4030/api/health",
            headers={"X-Request-ID": custom_id},
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("x-request-id"), custom_id)

        # Also verify passthrough via Nginx gateway on port 3084
        status_ng, _, headers_ng = http_request(
            "http://localhost:3084/api/health",
            headers={"X-Request-ID": custom_id},
        )
        self.assertEqual(status_ng, 200)
        self.assertEqual(headers_ng.get("x-request-id"), custom_id)

    def test_adv_02_missing_correlation_id_generates_uuid(self):
        """Verify omitted correlation header automatically generates a valid UUID."""
        status, body, headers = http_request("http://localhost:4030/api/health")
        self.assertEqual(status, 200)
        returned_id = headers.get("x-request-id", "")
        self.assertTrue(len(returned_id) > 0)
        self.assertRegex(returned_id, r"^[0-9a-f-]{36}$")

    def test_adv_02b_blank_correlation_id_graceful_handling(self):
        """Verify sending a blank X-Request-ID: '' succeeds with HTTP 200 without 500 crashes."""
        status, body, headers = http_request(
            "http://localhost:4030/api/health",
            headers={"X-Request-ID": ""},
        )
        self.assertEqual(status, 200)
        # Implementation in app/main.py preserves the exact empty header without crashing
        self.assertIn("x-request-id", headers)

    def test_adv_03_response_time_header_precision_format(self):
        """Verify X-Response-Time header is present and formatted as XX.XXms."""
        status, body, headers = http_request("http://localhost:4030/health")
        self.assertEqual(status, 200)
        self.assertIn("x-response-time", headers)
        time_header = headers.get("x-response-time")
        self.assertRegex(time_header, r"^[0-9]+\.[0-9]{2}ms$")

    def test_adv_04_method_not_allowed_405_enforcement(self):
        """Verify unsupported HTTP verbs on /health return 405 Method Not Allowed."""
        for verb in ["POST", "PUT", "DELETE"]:
            status, body, headers = http_request(
                "http://localhost:4030/health",
                method=verb,
            )
            self.assertEqual(status, 405, f"Expected 405 for verb {verb}")
            self.assertEqual(headers.get("allow"), "GET")
            self.assertIn("Method Not Allowed", body)

    def test_adv_05_nonexistent_api_endpoint_404_trace(self):
        """Verify non-existent API routes return 404 with trace headers attached."""
        status, body, headers = http_request("http://localhost:4030/api/v1/invalid_probe_path_xyz")
        self.assertEqual(status, 404)
        self.assertIn("x-request-id", headers)
        self.assertIn("x-response-time", headers)
        data = json.loads(body)
        self.assertEqual(data.get("detail"), "Not Found")

    def test_adv_06_malformed_json_body_422_validation(self):
        """Verify sending syntactically malformed JSON returns 422 Unprocessable Entity."""
        status, body, headers = http_request(
            "http://localhost:4030/api/v1/auth/resend-otp",
            method="POST",
            headers={"Content-Type": "application/json"},
            data="{malformed_json_payload",
        )
        self.assertEqual(status, 422)
        data = json.loads(body)
        self.assertIn("detail", data)
        self.assertEqual(data["detail"][0].get("type"), "json_invalid")

    def test_adv_07_invalid_field_schema_422_validation(self):
        """Verify Pydantic schema validation returns 422 for invalid email format."""
        status, body, headers = http_request(
            "http://localhost:4030/api/v1/auth/resend-otp",
            method="POST",
            headers={"Content-Type": "application/json"},
            data=json.dumps({"email": "not_an_email_address"}),
        )
        self.assertEqual(status, 422)
        data = json.loads(body)
        self.assertIn("detail", data)
        self.assertEqual(data["detail"][0]["loc"], ["body", "email"])


class TestTier5Domain2CorsSecurity(unittest.TestCase):
    """Domain 2: Cross-Origin Resource Sharing (CORS) & Origin Security."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_08_cors_preflight_authorized_origin_allowed(self):
        """Verify CORS preflight succeeds for whitelisted origin."""
        status, body, headers = http_request(
            "http://localhost:4030/api/health",
            method="OPTIONS",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("access-control-allow-origin"), "http://localhost:3000")
        self.assertEqual(headers.get("access-control-allow-credentials"), "true")

    def test_adv_09_cors_preflight_untrusted_origin_rejected(self):
        """Verify CORS preflight rejects untrusted/malicious origins with HTTP 400."""
        status, body, headers = http_request(
            "http://localhost:4030/api/health",
            method="OPTIONS",
            headers={
                "Origin": "http://untrusted-attacker-domain.evil",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(status, 400)
        self.assertIn("Disallowed CORS origin", body)
        self.assertNotIn("access-control-allow-origin", headers)

    def test_adv_10_cors_preflight_allowed_methods(self):
        """Verify preflight response specifies standard allowed REST methods."""
        status, body, headers = http_request(
            "http://localhost:4030/api/health",
            method="OPTIONS",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "POST",
            },
        )
        self.assertEqual(status, 200)
        methods = headers.get("access-control-allow-methods", "")
        for expected in ["GET", "POST", "PUT", "DELETE", "OPTIONS"]:
            self.assertIn(expected, methods)

    def test_adv_11_cors_simple_get_preserves_origin(self):
        """Verify simple GET request with whitelisted Origin returns Access-Control-Allow-Origin."""
        status, body, headers = http_request(
            "http://localhost:4030/health",
            headers={"Origin": "http://127.0.0.1:3000"},
        )
        self.assertEqual(status, 200)
        self.assertEqual(headers.get("access-control-allow-origin"), "http://127.0.0.1:3000")


class TestTier5Domain3NginxGatewayHardening(unittest.TestCase):
    """Domain 3: Nginx Gateway Reverse Proxy Routing & HTTP Hardening."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_12_virtual_host_admin_routing(self):
        """Verify Nginx routes Host: admin.localhost to tms-admin service."""
        status, body, headers = http_request(
            "http://localhost:3084/",
            headers={"Host": "admin.localhost"},
        )
        self.assertEqual(status, 200)
        self.assertIn("<title>Zolexora TMS — Admin Panel</title>", body)

    def test_adv_13_virtual_host_app_web_routing(self):
        """Verify Nginx routes Host: app.localhost to tms-web service."""
        status, body, headers = http_request(
            "http://localhost:3084/",
            headers={"Host": "app.localhost"},
        )
        self.assertEqual(status, 200)
        self.assertIn("<title>Zolexora TMS — Transport Management System</title>", body)

    def test_adv_14_virtual_host_api_routing(self):
        """Verify Nginx routes Host: api.localhost to tms-backend service directly."""
        status, body, headers = http_request(
            "http://localhost:3084/health",
            headers={"Host": "api.localhost"},
        )
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data.get("service"), "zolexora-tms-api")

    def test_adv_15_spa_fallback_routing(self):
        """Verify deep client routes fall back to index.html for SPA routing on tms-web."""
        status, body, headers = http_request("http://localhost:3084/operations/trips/live")
        self.assertEqual(status, 200)
        self.assertIn('<div id="root"></div>', body)
        self.assertIn("Zolexora TMS — Transport Management System", body)

    def test_adv_16_spa_fallback_admin_routing(self):
        """Verify deep client routes fall back to admin index.html on admin.localhost."""
        status, body, headers = http_request(
            "http://localhost:3084/management/fleet",
            headers={"Host": "admin.localhost"},
        )
        self.assertEqual(status, 200)
        self.assertIn('<div id="root"></div>', body)
        self.assertIn("Zolexora TMS — Admin Panel", body)

    def test_adv_17_uri_length_boundary_414_rejection(self):
        """Verify Nginx rejects excessively long URIs with 414 Request-URI Too Large."""
        oversized_path = "/" + "a" * 16384
        status, body, headers = http_request(f"http://localhost:3084{oversized_path}")
        self.assertEqual(status, 414)

    def test_adv_18_path_traversal_rejection_400(self):
        """Verify Nginx traps directory traversal attempts with 400 Bad Request."""
        status, body, headers = http_request("http://localhost:3084/../../../../etc/passwd")
        self.assertEqual(status, 400)

    def test_adv_19_sql_injection_probe_resilience(self):
        """Verify API endpoints safely ignore SQL injection parameters without crashing."""
        status, body, headers = http_request(
            "http://localhost:4030/api/ready?probe=%27%20OR%201=1--",
        )
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data.get("database"), "ok")


class TestTier5Domain4DatabaseSecurity(unittest.TestCase):
    """Domain 4: Database Live Health, Wire Protocol & Authentication Isolation."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_20_live_database_readiness_probe(self):
        """Verify /api/ready performs active database check returning database: ok."""
        # Check directly on backend port 4030
        status, body, _ = http_request("http://localhost:4030/api/ready")
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data.get("status"), "ready")
        self.assertEqual(data.get("database"), "ok")

        # Check through Nginx gateway on port 3084
        status_ng, body_ng, _ = http_request("http://localhost:3084/api/ready")
        self.assertEqual(status_ng, 200)
        data_ng = json.loads(body_ng)
        self.assertEqual(data_ng.get("database"), "ok")

    def test_adv_21_database_authentication_rejection(self):
        """Verify PostgreSQL rejects connection attempts to nonexistent databases."""
        rc, stdout, stderr = run_cmd(
            ["docker", "exec", "tms-postgres", "psql", "-U", "tms", "-d", "non_existent_db", "-c", "SELECT 1"],
            timeout=5.0,
        )
        self.assertNotEqual(rc, 0)
        combined_err = f"{stdout} {stderr}"
        self.assertIn("does not exist", combined_err)

    def test_adv_22_raw_tcp_garbage_packet_handling(self):
        """Verify sending garbage binary packet to PostgreSQL TCP port closes safely without crash."""
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(2.0)
        try:
            sock.connect(("127.0.0.1", 5448))
            sock.sendall(b"GARBAGE_ADVERSARIAL_PAYLOAD\x00\xFF\xAA\n")
            recv_data = sock.recv(1024)
            # PostgreSQL protocol closes connection cleanly upon invalid frame
            self.assertEqual(recv_data, b"")
        finally:
            sock.close()

    def test_adv_23_postgres_remains_healthy_after_abuse(self):
        """Verify pg_isready confirms database health after receiving adversarial packets."""
        rc, stdout, stderr = run_cmd(
            ["docker", "exec", "tms-postgres", "pg_isready", "-U", "tms", "-d", "tms"],
            timeout=5.0,
        )
        self.assertEqual(rc, 0)
        self.assertIn("accepting connections", stdout.lower())

    def test_adv_24_database_tables_accessible(self):
        """Verify PostgreSQL client inside container can list schema tables."""
        rc, stdout, stderr = run_cmd(
            ["docker", "exec", "tms-postgres", "psql", "-U", "tms", "-d", "tms", "-c", "\\dt"],
            timeout=5.0,
        )
        self.assertEqual(rc, 0)
        self.assertIn("public", stdout)


class TestTier5Domain5SecurityAndAuth(unittest.TestCase):
    """Domain 5: Security Credentials & Unauthenticated Access Control."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_25_unauthenticated_protected_route_rejection(self):
        """Verify protected endpoints reject requests without token with 401 Unauthorized."""
        status, body, headers = http_request("http://localhost:4030/api/v1/vehicles")
        self.assertEqual(status, 401)
        self.assertIn("www-authenticate", headers)
        self.assertIn("bearer", headers.get("www-authenticate", "").lower())
        data = json.loads(body)
        self.assertIn("detail", data)

    def test_adv_26_invalid_bearer_token_rejection(self):
        """Verify sending an invalid Bearer token is rejected with 401 Unauthorized."""
        status, body, headers = http_request(
            "http://localhost:4030/api/v1/vehicles",
            headers={"Authorization": "Bearer invalid_bearer_token_999"},
        )
        self.assertEqual(status, 401)
        data = json.loads(body)
        self.assertIn("Invalid or expired authorization token", data.get("detail", ""))

    def test_adv_27_nginx_proxy_preserves_auth_challenge(self):
        """Verify Nginx reverse proxy preserves 401 and WWW-Authenticate challenge header."""
        status, body, headers = http_request("http://localhost:3084/api/v1/vehicles")
        self.assertEqual(status, 401)
        self.assertIn("www-authenticate", headers)

    def test_adv_28_openapi_spec_documents_bearer_security(self):
        """Verify OpenAPI 3 specification defines HTTPBearer security scheme."""
        status, body, headers = http_request("http://localhost:4030/openapi.json")
        self.assertEqual(status, 200)
        spec = json.loads(body)
        self.assertIn("openapi", spec)
        schemes = spec.get("components", {}).get("securitySchemes", {})
        self.assertIn("HTTPBearer", schemes)
        self.assertEqual(schemes["HTTPBearer"].get("scheme"), "bearer")


class TestTier5Domain6EnvAndResources(unittest.TestCase):
    """Domain 6: Environment Passthrough, Dynamic Configuration & Resource Isolation."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_29_runtime_env_config_js_web(self):
        """Verify tms-web serves /env-config.js declaring window.__ENV__."""
        status, body, headers = http_request("http://localhost:3084/env-config.js")
        self.assertEqual(status, 200)
        self.assertTrue(headers.get("content-type", "").startswith("application/javascript"))
        self.assertIn("window.__ENV__", body)

    def test_adv_30_runtime_env_config_js_admin(self):
        """Verify tms-admin serves /env-config.js declaring window.__ENV__."""
        status, body, headers = http_request(
            "http://localhost:3084/env-config.js",
            headers={"Host": "admin.localhost"},
        )
        self.assertEqual(status, 200)
        self.assertTrue(headers.get("content-type", "").startswith("application/javascript"))
        self.assertIn("window.__ENV__", body)

    def test_adv_31_all_live_containers_enforce_512m_ram(self):
        """Verify all 5 live containers enforce strict memory limits of 512MB."""
        expected_bytes = "536870912"
        containers = ["tms-postgres", "tms-backend", "tms-web", "tms-admin", "tms-nginx"]
        for c in containers:
            rc, out, _ = run_cmd(["docker", "inspect", "-f", "{{.HostConfig.Memory}}", c])
            self.assertEqual(rc, 0)
            self.assertEqual(out.strip(), expected_bytes, f"Container {c} memory limit mismatch")

    def test_adv_32_all_live_containers_enforce_1_cpu(self):
        """Verify all 5 live containers enforce strict CPU quota limits of 1 CPU."""
        expected_nanocpus = "1000000000"
        containers = ["tms-postgres", "tms-backend", "tms-web", "tms-admin", "tms-nginx"]
        for c in containers:
            rc, out, _ = run_cmd(["docker", "inspect", "-f", "{{.HostConfig.NanoCpus}}", c])
            self.assertEqual(rc, 0)
            self.assertEqual(out.strip(), expected_nanocpus, f"Container {c} CPU limit mismatch")

    def test_adv_33_subcommand_flag_passthrough_in_script(self):
        """Verify startup script passes subcommands and flags (e.g. ps --services) cleanly."""
        script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, stdout, stderr = run_cmd([str(script), "ps", "--services"], timeout=10.0)
        self.assertEqual(rc, 0)
        services = set(stdout.strip().split())
        self.assertTrue({"backend", "nginx", "postgres", "tms-admin", "tms-web"}.issubset(services))

    def test_adv_34_concurrent_burst_stress_all_200(self):
        """Verify 20 concurrent requests across health endpoints all succeed under burst."""
        urls = [
            "http://localhost:3084/api/health",
            "http://localhost:4030/api/ready",
            "http://localhost:4030/health",
            "http://localhost:3084/api/ready",
        ] * 5

        def fetch(u):
            t0 = time.time()
            s, _, _ = http_request(u, timeout=5.0)
            return s, time.time() - t0

        start_time = time.time()
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch, urls))
        total_time = time.time() - start_time

        statuses = [s for s, _ in results]
        self.assertEqual(len(statuses), 20)
        self.assertTrue(all(s == 200 for s in statuses), f"Non-200 statuses observed: {statuses}")
        self.assertLess(total_time, 5.0, f"Burst took unexpectedly long: {total_time:.2f}s")


class TestTier5Domain7OperationalHardening(unittest.TestCase):
    """Domain 7: Advanced Operational Scenarios & Documentation."""

    @classmethod
    def setUpClass(cls):
        if not is_stack_running():
            raise unittest.SkipTest("TMS container stack is not currently running.")

    def test_adv_35_backend_root_redirects_to_docs(self):
        """Verify GET / on backend returns HTTP 307 redirecting to /docs."""
        status, body, headers = http_request(
            "http://localhost:4030/",
            follow_redirects=False,
        )
        self.assertEqual(status, 307)
        self.assertEqual(headers.get("location"), "/docs")

    def test_adv_36_swagger_ui_docs_accessible(self):
        """Verify Swagger UI documentation is served on /docs with HTTP 200."""
        status, body, headers = http_request("http://localhost:4030/docs")
        self.assertEqual(status, 200)
        self.assertIn("swagger-ui", body.lower())

    def test_adv_37_nginx_websocket_upgrade_headers_configured(self):
        """Verify Nginx default.conf defines WebSocket Upgrade and Connection headers."""
        conf_path = get_repo_root() / "products" / "zolexora-tms" / "nginx-conf.d" / "default.conf"
        self.assertTrue(conf_path.exists())
        content = conf_path.read_text(encoding="utf-8")
        self.assertIn("proxy_set_header Upgrade $http_upgrade;", content)
        self.assertIn('proxy_set_header Connection "upgrade";', content)

    def test_adv_38_script_invocation_from_external_cwd(self):
        """Verify startup script executes properly when invoked from external working directory."""
        script = get_repo_root() / "products" / "zolexora-tms" / "scripts" / "docker-start.sh"
        rc, stdout, stderr = run_cmd([str(script), "status"], cwd=Path("/tmp"), timeout=10.0)
        self.assertEqual(rc, 0)
        self.assertIn("tms-backend", stdout)


if __name__ == "__main__":
    unittest.main()
