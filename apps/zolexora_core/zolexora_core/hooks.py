from __future__ import annotations

app_name = "zolexora_core"
app_title = "Zolexora Core"
app_publisher = "Zolexora"
app_description = "Core business logic and setup routines for Zolexora ERP."
app_email = "info@zolexora.com"
app_license = "GPL-3.0-or-later"

document_events = {"*": {"on_update": "zolexora_core.api.on_document_update"}}

fixtures = [
    {
        "dt": "Workspace",
        "filters": [
            [
                "name",
                "in",
                [
                    "Zolexora Dashboard",
                    "Zolexora Accounts",
                    "Zolexora Sales",
                    "Zolexora Purchase",
                    "Zolexora Inventory",
                    "Zolexora CRM",
                    "Zolexora Fleet",
                    "Zolexora Logistics",
                    "Zolexora Analytics",
                    "Zolexora Administration",
                    "Zolexora AI",
                ],
            ]
        ],
    }
]

