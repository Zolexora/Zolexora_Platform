"""Offline, deterministic Supabase identity export mapper (dry-run only)."""

import argparse
import json
import uuid
from pathlib import Path

IDENTITY_NAMESPACE = uuid.UUID("ec5f2f82-a76b-4e90-a453-9655c2b4798d")
ROLE_MAP = {"viewer": "buyer", "buyer": "buyer", "seller": "seller", "admin": "admin"}


def map_export(source: dict, *, allow_privileged: bool = False) -> dict:
    profiles = {str(item.get("id")): item for item in source.get("public_users", [])}
    seen: set[str] = set()
    mapped: list[dict] = []
    rejected: list[dict] = []
    for item in sorted(source.get("auth_users", []), key=lambda value: str(value.get("id", ""))):
        source_id = str(item.get("id", ""))
        email = str(item.get("email", "")).strip().lower()
        profile = profiles.get(source_id, {})
        role = ROLE_MAP.get(str(profile.get("role", "viewer")).lower())
        reason = None
        if not email or "@" not in email:
            reason = "invalid_email"
        elif email in seen:
            reason = "duplicate_email"
        elif role is None:
            reason = "unknown_role"
        elif role in {"seller", "admin"} and not allow_privileged:
            reason = "privileged_role_requires_approval"
        if reason:
            rejected.append({"source_id": source_id, "reason": reason})
            continue
        seen.add(email)
        try:
            user_id = str(uuid.UUID(source_id))
        except ValueError:
            user_id = str(uuid.uuid5(IDENTITY_NAMESPACE, f"supabase:{source_id}:{email}"))
        mapped.append({
            "source_id": source_id,
            "user_id": user_id,
            "email": email,
            "name": str(profile.get("name") or email.split("@", 1)[0])[:200],
            "role": role,
            "is_email_verified": bool(item.get("email_confirmed_at")),
            "credential_action": "password_reset_required",
        })
    return {
        "mode": "dry-run",
        "counts": {"source": len(source.get("auth_users", [])), "mapped": len(mapped), "rejected": len(rejected)},
        "mapped": mapped,
        "rejected": rejected,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("export", type=Path, help="Immutable offline JSON export")
    parser.add_argument("--allow-privileged", action="store_true", help="Explicitly accept known seller/admin roles")
    args = parser.parse_args()
    source = json.loads(args.export.read_text(encoding="utf-8"))
    print(json.dumps(map_export(source, allow_privileged=args.allow_privileged), sort_keys=True, separators=(",", ":")))


if __name__ == "__main__":
    main()
