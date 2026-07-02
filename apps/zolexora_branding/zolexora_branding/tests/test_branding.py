from __future__ import annotations
import unittest
from zolexora_branding.startup import apply_branding


class TestZolexoraBranding(unittest.TestCase):
    def test_apply_branding(self):
        bootinfo = {}
        apply_branding(bootinfo)
        self.assertIn("zolexora_branding", bootinfo)
        self.assertEqual(bootinfo["zolexora_branding"]["brand"], "Zolexora ERP")
