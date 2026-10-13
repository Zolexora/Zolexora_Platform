#!/usr/bin/env python3
"""
Exports Antigravity conversation history into a clean, readable CHAT_HISTORY.md file.
Can be executed on-demand or as a background daemon to keep CHAT_HISTORY.md continuously updated.

Usage:
    python3 scripts/export-chat-md.py             # Export current chat to CHAT_HISTORY.md
    python3 scripts/export-chat-md.py --watch      # Continuously update in background every 30s
"""

import argparse
import datetime
import glob
import json
import os
import re
import sys
import time

TRANSCRIPT_PATH = "/home/vscode/.gemini/antigravity-cli/brain/9a799708-eac2-4bfc-a833-9d9ae6dc99dd/.system_generated/logs/transcript_full.jsonl"
DEFAULT_OUTPUT_MD = "/workspaces/Zolexora_Platform/CHAT_HISTORY.md"

def get_transcript_path():
    if os.path.exists(TRANSCRIPT_PATH):
        return TRANSCRIPT_PATH
    candidates = glob.glob("/home/vscode/.gemini/antigravity-cli/brain/*/.system_generated/logs/transcript_full.jsonl")
    if candidates:
        return max(candidates, key=os.path.getmtime)
    raise FileNotFoundError("No transcript log file found.")

def clean_user_content(text: str) -> str:
    """Strips internal system wrappers like <USER_REQUEST> and <ADDITIONAL_METADATA>."""
    if "<USER_REQUEST>" in text:
        match = re.search(r"<USER_REQUEST>(.*?)</USER_REQUEST>", text, re.DOTALL)
        if match:
            text = match.group(1).strip()
    # Remove context summary if present
    if "<CONTEXT_SUMMARY>" in text:
        text = re.sub(r"<CONTEXT_SUMMARY>.*?</CONTEXT_SUMMARY>", "", text, flags=re.DOTALL).strip()
    return text.strip()

def export_markdown(output_file: str = DEFAULT_OUTPUT_MD) -> int:
    transcript_file = get_transcript_path()
    messages = []

    with open(transcript_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                item = json.loads(line)
            except Exception:
                continue

            msg_type = item.get("type")
            content = item.get("content") or ""
            created_at = (item.get("created_at") or "")[:19].replace("T", " ")

            if msg_type == "USER_INPUT":
                cleaned = clean_user_content(content)
                if cleaned:
                    messages.append({
                        "role": "User",
                        "content": cleaned,
                        "time": created_at,
                    })
            elif msg_type == "PLANNER_RESPONSE" and content.strip():
                messages.append({
                    "role": "Antigravity",
                    "content": content.strip(),
                    "time": created_at,
                })

    now_utc = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")

    lines = [
        "# Zolexora Platform — Conversation Transcript",
        "",
        f"> **Last Updated:** {now_utc}  ",
        f"> **Total Messages:** {len(messages)}  ",
        f"> **Conversation ID:** `9a799708-eac2-4bfc-a833-9d9ae6dc99dd`",
        "",
        "---",
        "",
    ]

    for idx, msg in enumerate(messages, 1):
        role_emoji = "🧑" if msg["role"] == "User" else "🤖"
        lines.append(f"### {role_emoji} {msg['role']} (`{msg['time']}`)")
        lines.append("")
        lines.append(msg["content"])
        lines.append("")
        lines.append("---")
        lines.append("")

    with open(output_file, "w", encoding="utf-8") as out:
        out.write("\n".join(lines))

    return len(messages)

def main():
    parser = argparse.ArgumentParser(description="Export chat history to Markdown")
    parser.add_argument("--output", default=DEFAULT_OUTPUT_MD, help="Output markdown path")
    parser.add_argument("--watch", action="store_true", help="Keep running in background and update periodically")
    parser.add_argument("--interval", type=int, default=30, help="Watch interval in seconds (default: 30)")
    args = parser.parse_args()

    count = export_markdown(args.output)
    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Exported {count} messages to {args.output}")

    if args.watch:
        print(f"Watching for updates every {args.interval}s... Press Ctrl+C to exit.")
        last_mtime = 0
        transcript_file = get_transcript_path()
        try:
            while True:
                time.sleep(args.interval)
                current_mtime = os.path.getmtime(transcript_file)
                if current_mtime != last_mtime:
                    last_mtime = current_mtime
                    count = export_markdown(args.output)
                    print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Updated {args.output} ({count} messages)")
        except KeyboardInterrupt:
            print("\nStopped watcher.")

if __name__ == "__main__":
    main()
