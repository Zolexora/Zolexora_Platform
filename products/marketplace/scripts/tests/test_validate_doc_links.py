"""Unit tests for scripts/validate-doc-links.py offline documentation link validator."""

import sys
import tempfile
from pathlib import Path

# Add repository root to python sys.path
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import importlib
validate_doc_links = importlib.import_module("scripts.validate-doc-links")
validate_doc_content = validate_doc_links.validate_doc_content
remove_fenced_code_blocks = validate_doc_links.remove_fenced_code_blocks
extract_headings_as_anchors = validate_doc_links.extract_headings_as_anchors


def test_validator_cases():
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_root = Path(tmpdir).resolve()

        # Create valid target file & directory
        sub_dir = tmp_root / "docs"
        sub_dir.mkdir()
        target_file = sub_dir / "target file with space.md"
        target_file.write_text("# Target Section\n\nContent here.", encoding="utf-8")

        # Create main doc file
        main_doc = tmp_root / "main.md"
        main_doc.write_text(
            """# Main Document

## Section One

[Valid File](docs/target%20file%20with%20space.md)
[Valid Directory](docs/)
[Valid Same-Doc Anchor](#section-one)
[Valid Cross-Doc Anchor](docs/target%20file%20with%20space.md#target-section)

[External URL](https://example.com/api)
[Mailto](mailto:support@zolexora.com)

```markdown
[Ignored Code Link](non-existent-code-file.md)
```

[Missing Target](missing-file.md)
[Missing Anchor](#non-existent-anchor)
[Path Traversal](../../../etc/passwd)
""",
            encoding="utf-8",
        )

        links_checked, broken_links = validate_doc_content(main_doc, tmp_root)

        # Print summary for debugging
        print(f"Checked: {links_checked}, Broken: {len(broken_links)}")
        for src, link, reason in broken_links:
            print(f"  Broken: {link} -> {reason}")

        # Assertions
        assert links_checked > 0
        broken_targets = [b[1] for b in broken_links]

        # Verified broken targets
        assert "missing-file.md" in broken_targets
        assert "#non-existent-anchor" in broken_targets
        assert "../../../etc/passwd" in broken_targets

        # Verified valid targets NOT in broken_targets
        assert "docs/target%20file%20with%20space.md" not in broken_targets
        assert "docs/" not in broken_targets
        assert "#section-one" not in broken_targets
        assert "https://example.com/api" not in broken_targets
        assert "non-existent-code-file.md" not in broken_targets


if __name__ == "__main__":
    test_validator_cases()
    print("ALL VALIDATOR UNIT TESTS PASSED!")
