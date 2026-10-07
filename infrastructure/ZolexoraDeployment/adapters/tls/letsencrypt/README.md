# Let's Encrypt TLS adapter

Let's Encrypt is the default selected origin TLS adapter. It is not implemented, and DP-03 performs no certificate issuance.

The future implementation must produce an origin certificate valid for Cloudflare `Full (strict)`. Another configured TLS adapter may replace it without changing provider-neutral deployment behavior.
