#!/usr/bin/env python3
import urllib.request
import json
import argparse
import os
import sys

# Usage: notify.py --status success --product ZolexoraMarketplace --environment dev [--version v1.0.0] [--url https...]
# Requires: NOTIFY_WEBHOOK_URL env var.

def main():
    parser = argparse.ArgumentParser(description="Send deployment notification")
    parser.add_argument("--status", choices=["success", "failure", "cancelled"], required=True)
    parser.add_argument("--product", required=True)
    parser.add_argument("--environment", choices=["dev", "staging", "prod"], required=True)
    parser.add_argument("--version", default="unknown")
    parser.add_argument("--url", default="")
    
    args = parser.parse_args()
    
    webhook_url = os.environ.get("NOTIFY_WEBHOOK_URL")
    if not webhook_url:
        print("Warning: NOTIFY_WEBHOOK_URL not set. Skipping notification.", file=sys.stderr)
        sys.exit(0)
        
    status_emoji = {
        "success": "✅",
        "failure": "❌",
        "cancelled": "⚠️"
    }.get(args.status, "❓")
    
    # Build GitHub Run URL if running in Actions
    github_url = ""
    if os.environ.get("GITHUB_RUN_ID"):
        server_url = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
        repo = os.environ.get("GITHUB_REPOSITORY", "unknown/repo")
        run_id = os.environ.get("GITHUB_RUN_ID")
        github_url = f"{server_url}/{repo}/actions/runs/{run_id}"
        
    payload = {
        "text": f"{status_emoji} **{args.product}** deployment to **{args.environment}** {args.status}.",
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{status_emoji} *Deployment {args.status.capitalize()}*\n*Product:* {args.product}\n*Environment:* {args.environment}\n*Version:* {args.version}"
                }
            }
        ]
    }
    
    if args.url:
        payload["blocks"][0]["text"]["text"] += f"\n*URL:* {args.url}"
    if github_url:
        payload["blocks"][0]["text"]["text"] += f"\n*Logs:* <{github_url}|View Action Run>"
        
    req = urllib.request.Request(
        webhook_url, 
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status >= 400:
                print(f"Error: Webhook returned status {response.status}", file=sys.stderr)
                sys.exit(1)
            print("Notification sent successfully.")
    except Exception as e:
        print(f"Error sending notification: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
