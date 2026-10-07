# Nginx ownership

This directory will own reverse-proxy templates, hostname routing, security headers, timeouts, request-size limits, upstream configuration, internal health routes, and TLS integration.

Nginx is the only public origin HTTP/HTTPS listener. PostgreSQL and Redis are never proxied publicly. Functional Nginx configuration belongs to DP-09; DP-03 adds no configuration.
