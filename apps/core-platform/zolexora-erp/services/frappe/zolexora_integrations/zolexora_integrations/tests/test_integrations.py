from __future__ import annotations
import unittest
from zolexora_integrations.services.notifications import send_email_notification


class TestZolexoraIntegrations(unittest.TestCase):
    def test_send_email_notification(self):
        res = send_email_notification("test@example.com", "Subject", "Message")
        self.assertEqual(res["status"], "placeholder")
        self.assertEqual(res["channel"], "email")
