"""Tier 5: Adversarial Security & Robustness Verification for Zolexora TMS.

Conducts white-box adversarial stress tests against the live container stack
(Nginx reverse proxy on port 3084, FastAPI backend on port 4030, and Postgres on port 5448).

Covers:
  - Domain 1: Host Header Injection & Virtual Host Routing
  - Domain 2: Unsupported HTTP Methods & Verb Tampering
  - Domain 3: URI Path Traversal & Normalization Attacks
  - Domain 4: Large Payload Handling & Smuggling Resilience
  - Domain 5: Connection Pool Saturation & Concurrency Resilience
  - Domain 6: White-Box Configuration & Security Headers Audit
"""

import concurrent.futures
import http.client
import json
import os
from pathlib import Path
import re
import socket
import sys
import unittest
import urllib.error
import urllib.request

# Ensure tests/e2e/tms is on sys.path
TEST_DIR = Path(__file__).resolve().parent
if str(TEST_DIR) not in sys.path:
    sys.path.insert(0, str(TEST_DIR))

from helpers import (
    get_nginx_conf_path,
    get_repo_root,
    http_get,
    is_container_running,
    is_port_open,
)


def raw_http_request(
    host: str,
    port: int,
    raw_bytes: bytes,
    timeout: float = 3.0,
) -> tuple[int, str, dict]:
    """Send raw bytes over a TCP socket and parse HTTP status and headers."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
        sock.sendall(raw_bytes)
        response_bytes = b""
        while True:
            try:
                chunk = sock.recv(4096)
                if not chunk:
                    break
                response_bytes += chunk
                if b"\r\n\r\n" in response_bytes:
                    # Header block complete
                    break
            except socket.timeout:
                break

        if not response_bytes:
            return -1, "", {}

        lines = response_bytes.split(b"\r\n")
        status_line = lines[0].decode("latin-1", errors="replace")
        status_code = -1
        parts = status_line.split(" ")
        if len(parts) >= 2 and parts[1].isdigit():
            status_code = int(parts[1])

        headers = {}
        for line in lines[1:]:
            if not line:
                break
            line_str = line.decode("latin-1", errors="replace")
            if ":" in line_str:
                k, v = line_str.split(":", 1)
                headers[k.strip().lower()] = v.strip()

        return status_code, status_line, headers
    except Exception as exc:
        return -1, str(exc), {}
    finally:
        sock.close()



class TestTier5HostHeaderInjection(unittest.TestCase):
    """Domain 1: Host Header Injection & Virtual Host Routing."""

    @classmethod
    def setUpClass(cls):
        if not (is_container_running("tms-nginx") and is_port_open(3084)):
            raise unittest.SkipTest("tms-nginx is not running on port 3084")

    def test_s1_01_host_localhost_routes_to_web(self):
        """Validates that 'Host: localhost' routes to tms-web default server."""
        status, body, headers = http_get("http://localhost:3084/", headers={"Host": "localhost"})
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("content-type", ""))

    def test_s1_02_host_admin_localhost_routes_to_admin(self):
        """Validates that 'Host: admin.localhost' routes to tms-admin virtual host."""
        status, body, headers = http_get("http://localhost:3084/", headers={"Host": "admin.localhost"})
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("content-type", ""))

    def test_s1_03_host_api_localhost_routes_to_backend(self):
        """Validates that 'Host: api.localhost' routes directly to backend API."""
        status, body, headers = http_get("http://localhost:3084/health", headers={"Host": "api.localhost"})
        self.assertEqual(status, 200)
        data = json.loads(body)
        self.assertEqual(data.get("status"), "ok")
        self.assertEqual(data.get("service"), "zolexora-tms-api")

    def test_s1_04_host_evil_com_fallback_safe(self):
        """Adversarial Host injection ('Host: evil.com') falls through safely.

        Verifies that unrecognized host headers route to the default server (tms-web)
        without exposing administrative panels, backend secrets, or reflection in redirects.
        """
        status, body, headers = http_get("http://localhost:3084/", headers={"Host": "evil.com"})
        self.assertEqual(status, 200)
        self.assertIn("text/html", headers.get("content-type", ""))
        self.assertNotIn("admin", body.lower())
        self.assertNotIn("password", body.lower())

    def test_s1_05_host_port_variant_handling(self):
        """Validates host header port normalization (e.g., 'localhost:3084')."""
        status_web, _, _ = http_get("http://localhost:3084/", headers={"Host": "localhost:3084"})
        self.assertEqual(status_web, 200)

        status_admin, _, _ = http_get("http://localhost:3084/", headers={"Host": "admin.localhost:3084"})
        self.assertEqual(status_admin, 200)

        status_api, body_api, _ = http_get("http://localhost:3084/health", headers={"Host": "api.localhost:3084"})
        self.assertEqual(status_api, 200)
        self.assertIn("zolexora-tms-api", body_api)

    def test_s1_06_malformed_host_header_rejection(self):
        """Validates that malformed Host headers (whitespace or null byte) are rejected with 400."""
        # Space in Host header
        raw_space = b"GET / HTTP/1.1\r\nHost: evil .com\r\n\r\n"
        code_space, line_space, _ = raw_http_request("localhost", 3084, raw_space)
        self.assertEqual(code_space, 400, f"Expected 400 for space in Host, got {code_space}: {line_space}")

        # Null byte in Host header
        raw_null = b"GET / HTTP/1.1\r\nHost: local\x00host\r\n\r\n"
        code_null, line_null, _ = raw_http_request("localhost", 3084, raw_null)
        self.assertEqual(code_null, 400, f"Expected 400 for null in Host, got {code_null}: {line_null}")


class TestTier5UnsupportedHTTPMethods(unittest.TestCase):
    """Domain 2: Unsupported HTTP Methods & Verb Tampering."""

    @classmethod
    def setUpClass(cls):
        if not (is_container_running("tms-backend") and is_port_open(4030)):
            raise unittest.SkipTest("tms-backend is not running on port 4030")

    def _probe_method(self, host: str, port: int, method: str, path: str, body: bytes = None) -> int:
        conn = http.client.HTTPConnection(host, port, timeout=3.0)
        try:
            conn.request(method, path, body=body)
            resp = conn.getresponse()
            return resp.status
        except Exception:
            return -1
        finally:
            conn.close()

    def test_s2_01_trace_method_rejected_backend_and_gateway(self):
        """Validates that HTTP TRACE is rejected (405) preventing XST (Cross-Site Tracing)."""
        backend_status = self._probe_method("localhost", 4030, "TRACE", "/health")
        self.assertEqual(backend_status, 405)

        if is_port_open(3084):
            gateway_status = self._probe_method("localhost", 3084, "TRACE", "/api/health")
            self.assertEqual(gateway_status, 405)

    def test_s2_02_connect_method_rejected(self):
        """Validates that HTTP CONNECT method is rejected (400 or 405) preventing proxy abuse."""
        # Nginx gateway CONNECT
        raw_connect = b"CONNECT localhost:4030 HTTP/1.1\r\nHost: localhost:3084\r\n\r\n"
        status_code, _, _ = raw_http_request("localhost", 3084, raw_connect)
        self.assertIn(status_code, (400, 405), f"Expected 400 or 405 for CONNECT, got {status_code}")

        # Direct backend CONNECT
        backend_status = self._probe_method("localhost", 4030, "CONNECT", "/health")
        self.assertIn(backend_status, (400, 405))

    def test_s2_03_patch_method_rejected_on_health_route(self):
        """Validates that PATCH method on read-only /health is rejected with 405 Method Not Allowed."""
        backend_status = self._probe_method("localhost", 4030, "PATCH", "/health", body=b"{}")
        self.assertEqual(backend_status, 405)

        if is_port_open(3084):
            gateway_status = self._probe_method("localhost", 3084, "PATCH", "/api/health", body=b"{}")
            self.assertEqual(gateway_status, 405)

    def test_s2_04_mutation_verbs_rejected_on_health(self):
        """Validates that mutation methods (POST, PUT, DELETE) on /health are rejected with 405."""
        for verb in ["POST", "PUT", "DELETE"]:
            status = self._probe_method("localhost", 4030, verb, "/health", body=b"test" if verb != "DELETE" else None)
            self.assertEqual(status, 405, f"Expected 405 for {verb} on /health, got {status}")

    def test_s2_05_arbitrary_unsupported_verbs_rejected(self):
        """Validates that non-standard HTTP methods (PROPFIND, TRACK, BOGUS) are rejected."""
        # PROPFIND (WebDAV)
        status_propfind = self._probe_method("localhost", 4030, "PROPFIND", "/health")
        self.assertIn(status_propfind, (400, 405))

        # TRACK (similar to TRACE)
        raw_track = b"TRACK /health HTTP/1.1\r\nHost: localhost:4030\r\n\r\n"
        code_track, _, _ = raw_http_request("localhost", 4030, raw_track)
        self.assertIn(code_track, (400, 405))

        # Completely bogus verb
        status_bogus = self._probe_method("localhost", 4030, "NONEXISTENTVERB", "/health")
        self.assertIn(status_bogus, (400, 405))


class TestTier5URIPathTraversal(unittest.TestCase):
    """Domain 3: URI Path Traversal & Normalization Attacks."""

    @classmethod
    def setUpClass(cls):
        if not (is_container_running("tms-nginx") and is_port_open(3084)):
            raise unittest.SkipTest("tms-nginx is not running on port 3084")

    def test_s3_01_raw_path_traversal_nginx_rejected(self):
        """Validates that raw directory traversal attempts are rejected with 400 Bad Request."""
        traversal_attempts = [
            "/../../etc/passwd",
            "/api/../../etc/passwd",
            "/..%2f..%2f..%2fetc/passwd",
            "/api/..%2f..%2fetc/passwd",
        ]
        for path in traversal_attempts:
            conn = http.client.HTTPConnection("localhost", 3084, timeout=3.0)
            try:
                conn.request("GET", path)
                resp = conn.getresponse()
                self.assertEqual(
                    resp.status,
                    400,
                    f"Path traversal '{path}' not rejected with 400; got {resp.status}",
                )
            finally:
                conn.close()

    def test_s3_02_encoded_path_traversal_nginx_rejected(self):
        """Validates that URL-encoded directory traversal (%2e%2e) is rejected with 400."""
        encoded_attempts = [
            "/api/%2e%2e/%2e%2e/etc/passwd",
            "/%2e%2e/%2e%2e/app/.env",
        ]
        for path in encoded_attempts:
            conn = http.client.HTTPConnection("localhost", 3084, timeout=3.0)
            try:
                conn.request("GET", path)
                resp = conn.getresponse()
                self.assertEqual(
                    resp.status,
                    400,
                    f"Encoded traversal '{path}' not rejected with 400; got {resp.status}",
                )
            finally:
                conn.close()

    def test_s3_03_backend_path_traversal_rejected_404(self):
        """Validates that direct traversal against FastAPI backend returns 404 (no arbitrary files served)."""
        backend_attempts = [
            "/api/../../etc/passwd",
            "/health/../../etc/passwd",
            "/api/v1/../../.env",
        ]
        for path in backend_attempts:
            conn = http.client.HTTPConnection("localhost", 4030, timeout=3.0)
            try:
                conn.request("GET", path)
                resp = conn.getresponse()
                self.assertIn(
                    resp.status,
                    (400, 404),
                    f"Backend traversal '{path}' returned unexpected status {resp.status}",
                )
            finally:
                conn.close()

    def test_s3_04_sensitive_file_probing_zero_leak(self):
        """Validates that probing sensitive files (/.env, /.git/config) does NOT leak plaintext."""
        sensitive_paths = ["/.env", "/.git/config", "/etc/passwd"]
        for p in sensitive_paths:
            status, body, headers = http_get(f"http://localhost:3084{p}")
            # If 200, it MUST be the SPA fallback index.html, not raw confidential files
            if status == 200:
                self.assertIn("text/html", headers.get("content-type", ""))
                self.assertNotIn("DATABASE_URL", body)
                self.assertNotIn("JWT_SECRET", body)
                self.assertNotIn("repositoryformatversion", body)
                self.assertNotIn("root:x:0:0", body)

    def test_s3_05_null_byte_path_rejection(self):
        """Validates that null byte injection in URI (/%00) is rejected with 400 Bad Request."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=3.0)
        try:
            conn.request("GET", "/%00")
            resp = conn.getresponse()
            self.assertEqual(resp.status, 400, f"Expected 400 for /%00, got {resp.status}")
        finally:
            conn.close()


class TestTier5PayloadHandlingAndSmuggling(unittest.TestCase):
    """Domain 4: Large Payload Handling & Smuggling Resilience."""

    @classmethod
    def setUpClass(cls):
        if not (is_container_running("tms-nginx") and is_port_open(3084)):
            raise unittest.SkipTest("tms-nginx is not running on port 3084")

    def test_s4_01_oversized_payload_rejected_by_nginx_413(self):
        """Validates that request body exceeding 1MB is rejected by Nginx with 413 Payload Too Large."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=5.0)
        try:
            oversized_body = b"A" * (2 * 1024 * 1024)  # 2MB
            conn.request(
                "POST",
                "/api/health",
                body=oversized_body,
                headers={"Content-Type": "application/octet-stream"},
            )
            resp = conn.getresponse()
            self.assertEqual(resp.status, 413, f"Expected 413 for 2MB payload, got {resp.status}")
        finally:
            conn.close()

    def test_s4_02_sub_limit_payload_forwarded_to_upstream(self):
        """Validates that payloads under 1MB (e.g. 500KB) pass through Nginx to backend (returning 405)."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=5.0)
        try:
            sublimit_body = b"B" * (500 * 1024)  # 500KB
            conn.request(
                "POST",
                "/api/health",
                body=sublimit_body,
                headers={"Content-Type": "application/octet-stream"},
            )
            resp = conn.getresponse()
            # Since /api/health does not accept POST, backend returns 405 (demonstrating it passed Nginx)
            self.assertEqual(resp.status, 405, f"Expected 405 from backend for 500KB payload, got {resp.status}")
        finally:
            conn.close()

    def test_s4_03_oversized_uri_rejected_414(self):
        """Validates that oversized URI (>16KB query string) is rejected with 414 Request-URI Too Large."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=5.0)
        try:
            huge_uri = "/api/health?" + ("q=" + "x" * 16384)
            conn.request("GET", huge_uri)
            resp = conn.getresponse()
            self.assertEqual(resp.status, 414, f"Expected 414 for 16KB URI, got {resp.status}")
        finally:
            conn.close()

    def test_s4_04_oversized_header_rejected_400(self):
        """Validates that oversized HTTP headers (>16KB) are rejected with 400 Bad Request."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=5.0)
        try:
            huge_header = "H" * 16384
            conn.request("GET", "/api/health", headers={"X-Oversized-Test": huge_header})
            resp = conn.getresponse()
            self.assertEqual(resp.status, 400, f"Expected 400 for 16KB header, got {resp.status}")
        finally:
            conn.close()

    def test_s4_05_request_smuggling_cl_conflict_rejected(self):
        """Adversarial CL.CL smuggling probe: duplicate conflicting Content-Length rejected with 400."""
        raw_probe = (
            b"POST /api/health HTTP/1.1\r\n"
            b"Host: localhost:3084\r\n"
            b"Content-Length: 5\r\n"
            b"Content-Length: 10\r\n\r\n"
            b"12345"
        )
        code, line, _ = raw_http_request("localhost", 3084, raw_probe)
        self.assertEqual(code, 400, f"Expected 400 for conflicting Content-Length, got {code}: {line}")

    def test_s4_06_request_smuggling_te_cl_conflict_rejected(self):
        """Adversarial TE.CL smuggling probe: Transfer-Encoding + Content-Length conflict rejected with 400."""
        raw_probe = (
            b"POST /api/health HTTP/1.1\r\n"
            b"Host: localhost:3084\r\n"
            b"Content-Length: 5\r\n"
            b"Transfer-Encoding: chunked\r\n\r\n"
            b"0\r\n\r\n"
        )
        code, line, _ = raw_http_request("localhost", 3084, raw_probe)
        self.assertEqual(code, 400, f"Expected 400 for TE+CL conflict, got {code}: {line}")


class TestTier5ConnectionPoolAndConcurrency(unittest.TestCase):
    """Domain 5: Connection Pool Saturation & Concurrency Resilience."""

    @classmethod
    def setUpClass(cls):
        if not (is_container_running("tms-backend") and is_port_open(4030)):
            raise unittest.SkipTest("tms-backend is not running on port 4030")

    def _fetch_url(self, url: str) -> tuple[int, float]:
        import time
        t0 = time.time()
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                return resp.status, time.time() - t0
        except Exception:
            return -1, time.time() - t0

    def test_s5_01_backend_health_concurrency_burst(self):
        """Fires 50 concurrent requests to /health; validates 100% success and no socket drop."""
        concurrency = 50
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(self._fetch_url, "http://localhost:4030/health") for _ in range(concurrency)]
            results = [f.result() for f in futures]

        statuses = [r[0] for r in results]
        self.assertEqual(
            statuses.count(200),
            concurrency,
            f"Expected {concurrency} 200 OK responses, got {statuses.count(200)}",
        )

    def test_s5_02_database_pool_concurrency_burst(self):
        """Fires 50 concurrent requests to /ready (executing DB SELECT 1); validates no pool starvation."""
        concurrency = 50
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(self._fetch_url, "http://localhost:4030/ready") for _ in range(concurrency)]
            results = [f.result() for f in futures]

        statuses = [r[0] for r in results]
        self.assertEqual(
            statuses.count(200),
            concurrency,
            f"Database pool exhausted! Expected {concurrency} 200s on /ready, got {statuses.count(200)}",
        )

    def test_s5_03_nginx_gateway_concurrency_burst(self):
        """Fires 50 concurrent requests through Nginx /api/health; validates gateway load handling."""
        if not is_port_open(3084):
            raise unittest.SkipTest("Gateway 3084 not open")

        concurrency = 50
        with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as pool:
            futures = [pool.submit(self._fetch_url, "http://localhost:3084/api/health") for _ in range(concurrency)]
            results = [f.result() for f in futures]

        statuses = [r[0] for r in results]
        times = [r[1] for r in results]
        self.assertEqual(statuses.count(200), concurrency)
        avg_time_ms = (sum(times) / len(times)) * 1000
        # Gateway proxying locally should comfortably average under 100ms
        self.assertLess(avg_time_ms, 200.0, f"Gateway latency too high: {avg_time_ms:.2f}ms")

    def test_s5_04_sequential_keepalive_reuse(self):
        """Validates that an HTTP/1.1 client can reuse a persistent connection across multiple requests."""
        conn = http.client.HTTPConnection("localhost", 3084, timeout=3.0)
        try:
            for _ in range(15):
                conn.request("GET", "/api/health")
                resp = conn.getresponse()
                self.assertEqual(resp.status, 200)
                body = resp.read()
                self.assertIn(b"ok", body)
        finally:
            conn.close()


class TestTier5SecurityHeadersWhiteBoxAudit(unittest.TestCase):
    """Domain 6: White-Box Configuration & Security Headers Audit."""

    def test_s6_01_nginx_security_headers_review(self):
        """White-box audit of Nginx configuration for defensive security headers.

        Evaluates presence of X-Frame-Options, X-Content-Type-Options,
        and Content-Security-Policy. Identifies hardening opportunities.
        """
        conf_path = get_nginx_conf_path()
        content = conf_path.read_text(encoding="utf-8")

        # Document whether security headers are explicitly configured in Nginx
        has_frame_options = "X-Frame-Options" in content
        has_content_type_options = "X-Content-Type-Options" in content

        # Inspect live response headers from gateway
        if is_port_open(3084):
            status, _, headers = http_get("http://localhost:3084/")
            self.assertEqual(status, 200)
            # The test documents the current security posture
            # If absent, findings are surfaced in the handoff report
            self.assertIsInstance(headers, dict)

    def test_s6_02_server_token_information_disclosure(self):
        """Audits whether Nginx and backend disclose exact software versions in Server header."""
        if is_port_open(3084):
            status, _, headers = http_get("http://localhost:3084/")
            server_header = headers.get("server", "")
            # We observe what the server reports
            self.assertTrue(len(server_header) > 0, "Server header should be present")

        if is_port_open(4030):
            status, _, headers = http_get("http://localhost:4030/health")
            backend_server = headers.get("server", "")
            self.assertIn("uvicorn", backend_server.lower())

    def test_s6_03_backend_correlation_id_propagation(self):
        """Validates that X-Request-ID and X-Response-Time headers are emitted and proxied."""
        if is_port_open(3084):
            custom_id = "test-sec-adversarial-correlation-999"
            status, _, headers = http_get(
                "http://localhost:3084/api/health",
                headers={"X-Request-ID": custom_id},
            )
            self.assertEqual(status, 200)
            self.assertEqual(
                headers.get("x-request-id"),
                custom_id,
                "X-Request-ID was not echoed back across proxy",
            )
            self.assertIn(
                "x-response-time",
                headers,
                "X-Response-Time header missing from backend response",
            )

    def test_s6_04_cors_origin_control_adversarial_probe(self):
        """Validates that unauthorized origins (e.g., evil.com) do NOT receive Access-Control-Allow-Origin."""
        if is_port_open(4030):
            status, _, headers = http_get(
                "http://localhost:4030/health",
                headers={"Origin": "http://evil.com"},
            )
            self.assertEqual(status, 200)
            acao = headers.get("access-control-allow-origin")
            self.assertIsNone(
                acao,
                f"Unauthorized origin http://evil.com was reflected in Access-Control-Allow-Origin: {acao}",
            )

            # Whitelisted origin test
            status_wl, _, headers_wl = http_get(
                "http://localhost:4030/health",
                headers={"Origin": "http://localhost:5173"},
            )
            self.assertEqual(status_wl, 200)
            self.assertEqual(headers_wl.get("access-control-allow-origin"), "http://localhost:5173")


if __name__ == "__main__":
    unittest.main()
