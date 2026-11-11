from __future__ import annotations

app_name = "zolexora_branding"
app_title = "Zolexora ERP"
app_publisher = "Zolexora"
app_description = "Zolexora ERP branding, theme, and UI customization"
app_email = "admin@zolexora.com"
app_license = "MIT"

app_logo_url = "/assets/zolexora_branding/img/zolexora-icon.svg"
app_include_css = [
    "/assets/zolexora_branding/css/zolexora.css",
    "/assets/zolexora_branding/css/zolexora-theme.css",
    "/assets/zolexora_branding/css/login.css",
    "/assets/zolexora_branding/css/zolexora_dark.css",
]
app_include_js = [
    "/assets/zolexora_branding/js/zolexora.js",
    "/assets/zolexora_branding/js/zolexora-theme.js",
    "/assets/zolexora_branding/js/login.js",
]
web_include_css = [
    "/assets/zolexora_branding/css/zolexora-theme.css",
    "/assets/zolexora_branding/css/zolexora_dark.css",
]
web_include_js = "/assets/zolexora_branding/js/zolexora-theme.js"

boot_session = ["zolexora_branding.startup.apply_branding"]

website_context = {
    "favicon": "/assets/zolexora_branding/img/favicon.svg",
    "splash_image": "/assets/zolexora_branding/img/zolexora-logo.svg",
    "brand_html": '<span class="brand">Zolexora ERP</span>',
    "app_name": "Zolexora ERP",
}
