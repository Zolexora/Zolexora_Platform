"""docker-entrypoint.sh: backups are required unless IMS_REPLICATION=off (fake litestream/uvicorn/python on PATH)."""
import os
import subprocess
from pathlib import Path

ENTRYPOINT = Path(__file__).resolve().parent.parent / "docker-entrypoint.sh"
BACKUP = {
    "IMS_BACKUP_S3_BUCKET": "b",
    "IMS_BACKUP_S3_PATH": "test",
    "IMS_BACKUP_S3_ACCESS_KEY_ID": "id",
    "IMS_BACKUP_S3_SECRET_ACCESS_KEY": "key",
}


def run(tmp_path, **env):
    bin_dir = tmp_path / "bin"
    bin_dir.mkdir(exist_ok=True)
    log = tmp_path / "calls"
    for name in ("litestream", "uvicorn"):
        fake = bin_dir / name
        fake.write_text(f'#!/bin/sh\necho "{name} $*" >> "{log}"\n')
        fake.chmod(0o755)
    lock = bin_dir / "python"  # stands in for backup_lock.py: log it, then run the guarded command
    lock.write_text(f'#!/bin/sh\necho "lock $1" >> "{log}"\nshift\nexec "$@"\n')
    lock.chmod(0o755)
    full_env = {"PATH": f"{bin_dir}:/usr/bin:/bin", "PORT": "4050",
                "DATABASE_PATH": str(tmp_path / "data" / "ims.db"), **env}
    result = subprocess.run(["sh", str(ENTRYPOINT)], env=full_env, capture_output=True, text=True)
    calls = log.read_text().splitlines() if log.exists() else []
    return result, calls


def test_missing_backup_settings_stop_the_api(tmp_path):
    result, calls = run(tmp_path, IMS_BACKUP_S3_BUCKET="b")
    assert result.returncode == 1
    assert "IMS_BACKUP_S3_SECRET_ACCESS_KEY" in result.stderr
    assert calls == []


def test_replication_off_runs_api_with_warning(tmp_path):
    result, calls = run(tmp_path, IMS_REPLICATION="off")
    assert result.returncode == 0
    assert "NOT copied off this host" in result.stderr
    assert calls == ["uvicorn main:app --host 0.0.0.0 --port 4050"]


def test_configured_backup_restores_then_replicates(tmp_path):
    result, calls = run(tmp_path, **BACKUP)
    assert result.returncode == 0, result.stderr
    db = tmp_path / "data" / "ims.db"
    assert calls[0] == "lock /app/backup_lock.py"
    assert calls[1].startswith("litestream restore") and "-if-db-not-exists" in calls[1] and calls[1].endswith(str(db))
    assert calls[2].startswith("litestream replicate") and calls[2].endswith("-exec uvicorn main:app --host 0.0.0.0 --port 4050")
    assert os.path.isdir(db.parent)
