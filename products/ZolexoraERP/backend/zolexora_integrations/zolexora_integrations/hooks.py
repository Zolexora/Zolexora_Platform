from __future__ import annotations

app_name = "zolexora_integrations"
app_title = "Zolexora Integrations"
app_publisher = "Zolexora"
app_description = "Marketplace sync, external notifications, and webhook integrations for Zolexora ERP."
app_email = "info@zolexora.com"
app_license = "GPL-3.0-or-later"

scheduler_events = {
    "daily": ["zolexora_integrations.services.marketplace.sync_buyer_orders"]
}
