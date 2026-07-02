# Zolexora ERP Security Guide

Recommendations and configurations for securing the Zolexora ERP ecosystem.

---

## 1. Network & Infrastructure Security

- **SSL/TLS Encryption:** Enforce HTTPS in production. In Nginx or Cloudflare, redirect all HTTP traffic to HTTPS.
- **WebSocket Security:** Validate WebSocket (`/socket.io`) connections through Nginx using standard CORS controls.
- **Port Isolation:** MariaDB (3306) and Redis (6379) services must not expose ports publicly. Keep them isolated inside the bridge container network (`zolexora`).

---

## 2. API & Authorization Security

- **Whitelists Protection:** Never expose whitelisted REST endpoints without role verification. Ensure `validate_roles()` is called at the start of every custom controller to prevent guest/unauthorized access.
- **Strict CORS & CSRF:** Set `CORS_ALLOWED_ORIGINS` and `CSRF_TRUSTED_ORIGINS` in `.env` to restrict cross-site requests to verified domain names.
- **Password Strength:** Configure Frappe's System Settings to require strong password validation parameters (min length, special chars, numbers).
