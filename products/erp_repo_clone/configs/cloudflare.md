# Cloudflare Configuration Guide

## DNS

Create a CNAME or A record for `erp.zolexora.com` pointing to your Northflank service endpoint.

## SSL

Use Cloudflare SSL/TLS mode with Full (strict) where possible.

## Security

Enable HTTPS redirection and set minimum TLS version to 1.2 or higher.
Use Cloudflare firewall rules to protect admin endpoints.
