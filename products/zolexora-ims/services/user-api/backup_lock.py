"""One IMS API per backup path: runs a command only while holding a lock object in the backup bucket.

  python backup_lock.py <command...>     (docker-entrypoint.sh: Litestream restore, then replicate + API)

The lock is <IMS_BACKUP_S3_PATH>.ims-api.lock (beside Litestream's files, not among them), renewed every 30 s with conditional writes. A second API on
the same path (an overlapping deploy, a second instance) waits up to 2 minutes for it, then exits with an
error instead of writing a second copy of the database. A lock not renewed for 90 s (crashed host) is taken
over. Ages are measured on the bucket's clock, so host clocks don't matter. The lock is released after the
command exits, i.e. after Litestream has pushed the last changes.
"""
import json
import os
import signal
import socket
import subprocess
import sys
import time
import uuid
from email.utils import parsedate_to_datetime

RENEW, STALE, WAIT = 30, 90, 120


def log(msg: str) -> None:
    print(f"[backup-lock] {msg}", file=sys.stderr, flush=True)


class Lock:
    def __init__(self, s3, bucket: str, key: str):
        self.s3, self.bucket, self.key = s3, bucket, key
        self.owner = f"{socket.gethostname()}/{uuid.uuid4().hex[:8]}"

    def _read(self):
        """(holder, seconds since last renewal, etag), or (None, None, None) if there is no lock."""
        try:
            r = self.s3.get_object(Bucket=self.bucket, Key=self.key)
        except Exception as e:
            if _status(e) == 404:
                return None, None, None
            raise
        now = parsedate_to_datetime(r["ResponseMetadata"]["HTTPHeaders"]["date"])
        age = (now - r["LastModified"]).total_seconds()
        return json.loads(r["Body"].read())["owner"], age, r["ETag"]

    def _write(self, **condition) -> None:
        self.s3.put_object(Bucket=self.bucket, Key=self.key, Body=json.dumps({"owner": self.owner}).encode(), **condition)

    def try_acquire(self):
        """None once held; otherwise a description of who holds it."""
        holder, age, etag = self._read()
        try:
            if holder is None:
                self._write(IfNoneMatch="*")
            elif holder == self.owner or age > STALE:
                self._write(IfMatch=etag)
            else:
                return f"{holder}, renewed {int(age)} s ago"
        except Exception as e:
            if _status(e) in (409, 412):
                return "another API that took it just now"
            raise
        return None

    def renew(self) -> bool:
        holder, _, etag = self._read()
        if holder != self.owner:
            return False
        try:
            self._write(IfMatch=etag)
        except Exception as e:
            if _status(e) in (409, 412):
                return False
            raise
        return True

    def release(self) -> None:
        if self._read()[0] == self.owner:
            self.s3.delete_object(Bucket=self.bucket, Key=self.key)


def _status(e: Exception):
    return getattr(e, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode")


def run(lock: Lock, cmd, wait=WAIT, renew_every=RENEW, pause=10) -> int:
    deadline = time.monotonic() + wait
    while (holder := lock.try_acquire()) is not None:
        if time.monotonic() > deadline:
            log(f"Another IMS API is active on this backup path ({holder}). Stop it first: run one API per "
                "database, and deploy by stopping the old container before starting the new one.")
            return 1
        log(f"Waiting for the other IMS API to stop ({holder})")
        time.sleep(pause)
    log(f"Lock held by {lock.owner}")

    child = subprocess.Popen(cmd)
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda s, _f: child.send_signal(s))
    last_ok = time.monotonic()
    try:
        while True:
            try:
                return child.wait(timeout=renew_every)
            except subprocess.TimeoutExpired:
                pass
            try:
                if not lock.renew():
                    raise RuntimeError("another API took the lock")
                last_ok = time.monotonic()
            except Exception as e:
                log(f"Could not renew the lock: {e}")
                if time.monotonic() - last_ok > STALE - renew_every or isinstance(e, RuntimeError):
                    log("Stopping this API so two never write to one database.")
                    child.terminate()
                    child.wait()
                    return 1
    finally:
        try:
            lock.release()
        except Exception as e:
            log(f"Could not release the lock (it expires in {STALE} s): {e}")


def main() -> int:
    import boto3
    from botocore.config import Config

    s3 = boto3.client(
        "s3",
        endpoint_url=os.getenv("IMS_BACKUP_S3_ENDPOINT") or None,
        region_name=os.getenv("IMS_BACKUP_S3_REGION") or "us-east-1",
        aws_access_key_id=os.environ["IMS_BACKUP_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["IMS_BACKUP_S3_SECRET_ACCESS_KEY"],
        config=Config(request_checksum_calculation="when_required", response_checksum_validation="when_required"),
    )
    key = os.environ["IMS_BACKUP_S3_PATH"].strip("/") + ".ims-api.lock"
    return run(Lock(s3, os.environ["IMS_BACKUP_S3_BUCKET"], key), sys.argv[1:])


if __name__ == "__main__":
    sys.exit(main())
