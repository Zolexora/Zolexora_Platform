from __future__ import annotations
import unittest
from zolexora_platform.services.ai import get_assistant_hint


class TestZolexoraPlatform(unittest.TestCase):
    def test_assistant_hint(self):
        hint = get_assistant_hint()
        self.assertIn("Zolexora", hint)
