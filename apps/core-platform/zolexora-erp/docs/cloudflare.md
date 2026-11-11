# Cloudflare Integration Guide

Recommendations and configurations for proxying Zolexora ERP behind Cloudflare.

---

## 1. DNS Setup

- Create an `A` record pointing to your server IP, or a `CNAME` record pointing to your cloud container service (e.g. Northflank).
- Turn on the Orange Cloud proxy status for the DNS record to enable CDN caching, WAF security, and DDoS protection.

---

## 2. SSL/TLS Settings

- **SSL Mode:** Select "Full (Strict)" mode. This requires your origin server to have a valid SSL certificate (from Let's Encrypt or Cloudflare Origin CA).
- **Security Upgrades:** Enable "Always Use HTTPS" and "Automatic HTTPS Rewrites".

---

## 3. Web Application Firewall (WAF) & Rate Limiting

- **Rate Limiting:** Enforce a rate limit on `/api/method/frappe.integrations.oauth2.token` and login endpoints (e.g., max 10 requests per minute from a single IP).
- **Security Headers:** Add Page Rules or Cloudflare Transform Rules to enforce HTTP Strict Transport Security (HSTS) headers.
