#!/usr/bin/env python3
"""Offline Documentation Link Validator for Zolexora Marketplace.

Scans Markdown files across the repository, validates local relative file,
directory, and anchor links, ignores external HTTP/HTTPS/mailto URLs, skips
fenced code blocks, safely handles percent-encoding and path traversal, and
exits with code 0 on success or 1 if broken local links are detected.
"""

import os
import re
import sys
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".venv",
    ".next",
    ".turbo",
    "dist",
    "build",
    "coverage",
    "__pycache__",
}


def get_markdown_files(root_dir: Path) -> list[Path]:
    md_files = []
    for path in root_dir.rglob("*.md"):
        rel_parts = set(path.relative_to(root_dir).parts)
        if not rel_parts.intersection(EXCLUDE_DIRS):
            md_files.append(path)
    return sorted(md_files)


def remove_fenced_code_blocks(content: str) -> str:
    """Removes fenced code blocks (```...``` and ~~~...~~~) to prevent scanning false-positive code examples."""
    pattern = re.compile(r"(```[\s\S]*?```|~~~[\s\S]*?~~~)", re.MULTILINE)
    return pattern.sub("", content)


def extract_headings_as_anchors(content: str) -> set[str]:
    """Generates Github-style heading anchors from markdown headings."""
    anchors = set()
    for line in content.splitlines():
        line = line.strip()
        if line.startswith("#"):
            # Remove leading '#' characters and strip
            heading_text = line.lstrip("#").strip()
            # GitHub anchor slugification: lowercase, strip punctuation, spaces to hyphens
            slug = re.sub(r"[^\w\s-]", "", heading_text.lower())
            slug = re.sub(r"[\s_]+", "-", slug).strip("-")
            if slug:
                anchors.add(slug)
    return anchors


def validate_doc_content(
    doc_path: Path, root_dir: Path
) -> tuple[int, list[tuple[str, str, str]]]:
    raw_content = doc_path.read_text(encoding="utf-8", errors="ignore")
    clean_content = remove_fenced_code_blocks(raw_content)
    doc_anchors = extract_headings_as_anchors(raw_content)

    rel_doc_path = str(doc_path.relative_to(root_dir))
    links_checked = 0
    broken_links = []

    # Regex matching Markdown links: [text](target)
    link_pattern = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")

    for text, raw_target in link_pattern.findall(clean_content):
        target = raw_target.strip()

        # Skip empty, external, or mailto links
        if not target or target.startswith(("http://", "https://", "mailto:")):
            continue

        links_checked += 1

        # Percent-decode target URL
        decoded_target = urllib.parse.unquote(target)

        # Handle same-document anchor links: #heading-slug
        if decoded_target.startswith("#"):
            anchor_name = decoded_target[1:].strip()
            if anchor_name and anchor_name not in doc_anchors:
                broken_links.append(
                    (rel_doc_path, target, f"Missing same-doc anchor '#{anchor_name}'")
                )
            continue

        # Handle file:// absolute paths pointing inside workspace
        if decoded_target.startswith("file://"):
            clean_target = decoded_target.replace("file://", "").strip()
            # Split path and anchor
            parts = clean_target.split("#", 1)
            target_file_str = parts[0]
            anchor_name = parts[1] if len(parts) > 1 else None
            try:
                target_path = Path(target_file_str).resolve()
            except Exception:
                broken_links.append((rel_doc_path, target, "Invalid file URL"))
                continue
        else:
            # Split path and anchor
            parts = decoded_target.split("#", 1)
            target_file_str = parts[0].strip()
            anchor_name = parts[1].strip() if len(parts) > 1 else None

            if not target_file_str:
                continue

            target_path = (doc_path.parent / target_file_str).resolve()

        # Security check: Reject path traversal outside repository root
        try:
            if not target_path.is_relative_to(root_dir.resolve()):
                broken_links.append(
                    (rel_doc_path, target, f"Path traversal outside root: {target_path}")
                )
                continue
        except AttributeError:
            # Fallback for Python < 3.9
            if not str(target_path).startswith(str(root_dir.resolve())):
                broken_links.append(
                    (rel_doc_path, target, f"Path traversal outside root: {target_path}")
                )
                continue

        # Verify target file or directory exists on disk
        if not target_path.exists():
            broken_links.append(
                (rel_doc_path, target, f"Target path does not exist: {target_path}")
            )
            continue

        # If target file exists and an anchor was specified, verify anchor
        if anchor_name and target_path.is_file() and target_path.suffix.lower() == ".md":
            target_content = target_path.read_text(encoding="utf-8", errors="ignore")
            target_anchors = extract_headings_as_anchors(target_content)
            if anchor_name not in target_anchors:
                broken_links.append(
                    (
                        rel_doc_path,
                        target,
                        f"Target anchor '#{anchor_name}' missing in '{target_path.relative_to(root_dir)}'",
                    )
                )

    return links_checked, broken_links


def validate_links(root_dir: Path) -> tuple[int, int, list[tuple[str, str, str]]]:
    md_files = get_markdown_files(root_dir)
    total_files = len(md_files)
    total_links = 0
    all_broken_links = []

    for doc_path in md_files:
        links_checked, broken = validate_doc_content(doc_path, root_dir)
        total_links += links_checked
        all_broken_links.extend(broken)

    return total_files, total_links, all_broken_links


def main() -> int:
    total_files, total_links, broken_links = validate_links(ROOT)

    print("==================================================")
    print("Zolexora Marketplace — Offline Doc Link Validator")
    print("==================================================")
    print(f"Repository Root: {ROOT}")
    print(f"Markdown Files Checked: {total_files}")
    print(f"Local Relative Links Checked: {total_links}")

    if broken_links:
        print(f"\nFAILED: Found {len(broken_links)} broken local link(s):")
        for src, link, reason in broken_links:
            print(f"  - In '{src}': link '{link}' -> {reason}")
        return 1

    print("\nSUCCESS: All local relative documentation links resolved cleanly.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
