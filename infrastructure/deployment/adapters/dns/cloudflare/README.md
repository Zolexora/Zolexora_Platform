# Cloudflare DNS adapter

Cloudflare is the initially selected DNS, proxy, CDN, and WAF adapter. No API implementation exists yet, and no credentials belong in this directory.

Cloudflare origin TLS must use `Full (strict)`. DNS mutation always requires explicit authorization. Provider-neutral core may invoke this integration only through an explicitly selected adapter interface; it must never assume Cloudflare.
