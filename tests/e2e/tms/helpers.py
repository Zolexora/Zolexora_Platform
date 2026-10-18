"""Helper functions and test fixtures for Zolexora TMS E2E tests."""

import json
import os
from pathlib import Path
import re
import socket
import subprocess
from typing import Any, Dict, List, Optional, Tuple
import urllib.error
import urllib.request


def get_repo_root() -> Path:
    """Return the absolute path to the monorepo root."""
    return Path(__file__).resolve().parents[3]


def get_tms_compose_path() -> Path:
    """Return the path to canonical compose.yaml."""
    return get_repo_root() / "products" / "zolexora-tms" / "compose.yaml"


def get_infisical_config_path() -> Path:
    """Return the path to TMS .infisical.json."""
    return get_repo_root() / "products" / "zolexora-tms" / ".infisical.json"


def get_tms_env_example_path() -> Path:
    """Return the path to TMS example environment config."""
    return get_repo_root() / "config" / "envs" / "zolexora-tms" / "tms.env.example"


def get_nginx_conf_path() -> Path:
    """Return the path to TMS Nginx default.conf."""
    return get_repo_root() / "products" / "zolexora-tms" / "nginx-conf.d" / "default.conf"


def find_tms_startup_scripts() -> List[Path]:
    """Return existing TMS startup scripts in priority order."""
    root = get_repo_root()
    candidates = [
        root / "products" / "zolexora-tms" / "scripts" / "docker-start.sh",
    ]
    return [p for p in candidates if p.exists()]


def run_cmd(
    cmd: List[str] | str,
    cwd: Optional[Path] = None,
    env: Optional[Dict[str, str]] = None,
    timeout: float = 30.0,
    input_text: Optional[str] = None,
) -> Tuple[int, str, str]:
    """Execute a system command and return (returncode, stdout, stderr)."""
    if cwd is None:
        cwd = get_repo_root()

    effective_env = os.environ.copy()
    if env:
        effective_env.update(env)

    use_shell = isinstance(cmd, str)
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(cwd),
            env=effective_env,
            shell=use_shell,
            capture_output=True,
            text=True,
            timeout=timeout,
            input=input_text,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout.decode("utf-8", errors="replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        stderr = exc.stderr.decode("utf-8", errors="replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
        return -1, stdout, f"Command timed out after {timeout} seconds: {stderr}"


def is_port_open(port: int, host: str = "127.0.0.1", timeout: float = 1.0) -> bool:
    """Check if a TCP port is accepting connections on host."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        res = sock.connect_ex((host, port))
        return res == 0
    except OSError:
        return False
    finally:
        sock.close()


def is_container_running(container_name: str) -> bool:
    """Check if a Docker container is running via docker inspect."""
    rc, out, _ = run_cmd(
        ["docker", "inspect", "-f", "{{.State.Running}}", container_name],
        timeout=5.0,
    )
    return rc == 0 and out.strip() == "true"


def get_container_health(container_name: str) -> str:
    """Return container health status (healthy, unhealthy, starting, or none)."""
    rc, out, _ = run_cmd(
        ["docker", "inspect", "-f", "{{if .State.Health}}{{.State.Health.Status}}{{else}}no_healthcheck{{end}}", container_name],
        timeout=5.0,
    )
    if rc != 0:
        return "not_found"
    return out.strip()


def is_stack_running() -> bool:
    """Return True if core TMS containers (postgres and backend or nginx) are running."""
    return is_container_running("tms-postgres") and (
        is_container_running("tms-backend") or is_container_running("tms-nginx")
    )


class CaseInsensitiveDict(dict):
    """Case-insensitive dictionary for HTTP headers conforming to RFC 7230/9110."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._lower_map = {k.lower(): k for k in self.keys()}

    def __contains__(self, key):
        return super().__contains__(key) or str(key).lower() in self._lower_map

    def __getitem__(self, key):
        if super().__contains__(key):
            return super().__getitem__(key)
        lower_key = str(key).lower()
        if lower_key in self._lower_map:
            return super().__getitem__(self._lower_map[lower_key])
        raise KeyError(key)

    def get(self, key, default=None):
        try:
            return self[key]
        except KeyError:
            return default


def http_get(
    url: str,
    headers: Optional[Dict[str, str]] = None,
    timeout: float = 5.0,
) -> Tuple[int, str, Dict[str, str]]:
    """Execute an HTTP GET request using urllib and return (status, body, headers)."""
    req_headers = headers or {}
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
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

