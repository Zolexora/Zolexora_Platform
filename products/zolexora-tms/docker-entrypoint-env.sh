#!/bin/sh
# Generate /usr/share/nginx/html/env-config.js dynamically in container RAM from container environment
echo "window.__ENV__ = {" > /usr/share/nginx/html/env-config.js
for var in $(env | grep -E '^(NEXT_PUBLIC|VITE)_' | cut -d= -f1); do
  val=$(eval echo "\$$var")
  echo "  \"$var\": \"$val\"," >> /usr/share/nginx/html/env-config.js
done
echo "};" >> /usr/share/nginx/html/env-config.js
