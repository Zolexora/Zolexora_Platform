from __future__ import annotations
import unittest
from zolexora_core.api import health_check


class TestZolexoraCoreAPI(unittest.TestCase):
    def test_health_check(self):
        res = health_check()
        self.assertEqual(res["status"], "ok")
        self.assertEqual(res["app"], "zolexora_core")
