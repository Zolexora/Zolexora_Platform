#!/usr/bin/env python3
"""
Terminal Chat Viewer for Antigravity Conversations.
Usage:
    python3 scripts/view-chat.py               # View full formatted chat
    python3 scripts/view-chat.py | less -R      # Scroll with arrows / PageUp / PageDown
    python3 scripts/view-chat.py --last 10      # View last 10 messages
    python3 scripts/view-chat.py --user-only    # View only user prompts
"""

import argparse
import glob
import json
import os
import sys

TRANSCRIPT_PATH = "/home/vscode/.gemini/antigravity-cli/brain/9a799708-eac2-4bfc-a833-9d9ae6dc99dd/.system_generated/logs/transcript_full.jsonl"

def parse_args():
    parser = argparse.ArgumentParser(description="View chat history in the terminal")
    parser.add_argument("--last", type=int, default=0, help="Show only the last N messages")
    parser.add_argument("--user-only", action="store_true", help="Show only user prompts")
    parser.add_argument("--compact", action="store_true", help="Omit timestamps and borders")
    return parser.parse_args()

def main():
    if not os.path.exists(TRANSCRIPT_PATH):
        candidates = glob.glob("/home/vscode/.gemini/antigravity-cli/brain/*/.system_generated/logs/transcript_full.jsonl")
        if candidates:
            log_file = max(candidates, key=os.path.getmtime)
        else:
            print("No transcript log file found.", file=sys.stderr)
            sys.exit(1)
    else:
        log_file = TRANSCRIPT_PATH

    args = parse_args()

    messages = []
    with open(log_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                msg = json.loads(line)
            except Exception:
                continue

            msg_type = msg.get("type")
            content = msg.get("content") or ""
            time_str = (msg.get("created_at") or "")[:19].replace("T", " ")

            if msg_type == "USER_INPUT":
                clean_content = content
                if "<USER_REQUEST>" in clean_content:
                    start = clean_content.find("<USER_REQUEST>") + len("<USER_REQUEST>")
                    end = clean_content.find("</USER_REQUEST>")
                    if end > start:
                        clean_content = clean_content[start:end].strip()
                messages.append(("USER", clean_content.strip(), time_str))
            elif msg_type == "PLANNER_RESPONSE" and content.strip() and not args.user_only:
                messages.append(("ASSISTANT", content.strip(), time_str))

    if args.last > 0:
        messages = messages[-args.last:]

    for role, text, time_str in messages:
        if role == "USER":
            if args.compact:
                print(f"\n[USER]: {text}")
            else:
                print(f"\n\033[1;36m┏━━ 🧑 USER [{time_str}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
                print(text)
                print(f"\033[1;36m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
        else:
            if args.compact:
                print(f"\n[ASSISTANT]:\n{text}\n")
            else:
                print(f"\n\033[1;32m┏━━ 🤖 ANTIGRAVITY [{time_str}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")
                print(text)
                print(f"\033[1;32m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\033[0m")

if __name__ == "__main__":
    main()
