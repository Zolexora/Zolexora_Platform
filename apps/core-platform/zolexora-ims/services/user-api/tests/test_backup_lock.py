"""backup_lock.py: one API per backup path, against an in-memory bucket with conditional writes."""
import sys
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from io import BytesIO

import pytest

import backup_lock
from backup_lock import Lock, run


class Err(Exception):
    def __init__(self, status):
        self.response = {"ResponseMetadata": {"HTTPStatusCode": status}}


class Bucket:
    """get/put/delete with If-Match / If-None-Match; `now` is the bucket's clock."""

    def __init__(self):
        self.objects, self.now, self.n = {}, datetime(2026, 11, 11, tzinfo=timezone.utc), 0

    def get_object(self, Bucket, Key):
        if Key not in self.objects:
            raise Err(404)
        body, etag, modified = self.objects[Key]
        return {"Body": BytesIO(body), "ETag": etag, "LastModified": modified,
                "ResponseMetadata": {"HTTPHeaders": {"date": format_datetime(self.now, usegmt=True)}}}

    def put_object(self, Bucket, Key, Body, IfNoneMatch=None, IfMatch=None):
        current = self.objects.get(Key)
        if (IfNoneMatch and current) or (IfMatch and (not current or current[1] != IfMatch)):
            raise Err(412)
        self.n += 1
        self.objects[Key] = (Body, f'"{self.n}"', self.now)
        return {"ETag": f'"{self.n}"'}

    def delete_object(self, Bucket, Key):
        self.objects.pop(Key, None)


def test_second_api_is_refused_while_the_first_renews():
    b = Bucket()
    first, second = Lock(b, "b", "prod.ims-api.lock"), Lock(b, "b", "prod.ims-api.lock")
    assert first.try_acquire() is None
    b.now += timedelta(seconds=60)
    assert first.renew()
    b.now += timedelta(seconds=60)
    assert "renewed 60 s ago" in second.try_acquire()


def test_stale_lock_is_taken_over_and_the_old_holder_notices():
    b = Bucket()
    old, new = Lock(b, "b", "k"), Lock(b, "b", "k")
    assert old.try_acquire() is None
    b.now += timedelta(seconds=backup_lock.STALE + 1)
    assert new.try_acquire() is None
    assert not old.renew()
    old.release()  # not its lock any more: left alone
    assert b.objects


def test_simultaneous_first_writes_only_one_wins():
    b = Bucket()
    a, c = Lock(b, "b", "k"), Lock(b, "b", "k")
    a._read = c._read = lambda: (None, None, None)  # both saw no lock
    assert a.try_acquire() is None
    assert c.try_acquire() == "another API that took it just now"


def test_run_holds_the_lock_while_the_command_runs_then_releases():
    b = Bucket()
    assert run(Lock(b, "b", "k"), [sys.executable, "-c", "import time; time.sleep(0.3)"], renew_every=0.1) == 0
    assert b.objects == {}


def test_run_gives_up_when_another_api_keeps_the_lock():
    b = Bucket()
    assert Lock(b, "b", "k").try_acquire() is None
    assert run(Lock(b, "b", "k"), ["true"], wait=0, pause=0) == 1


def test_run_stops_the_api_when_the_lock_is_taken():
    b = Bucket()
    mine = Lock(b, "b", "k")
    mine.renew = lambda: False
    assert run(mine, [sys.executable, "-c", "import time; time.sleep(30)"], renew_every=0.1) == 1
