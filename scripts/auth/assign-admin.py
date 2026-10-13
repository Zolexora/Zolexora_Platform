#!/usr/bin/env python3
"""
Zolexora Platform — Supabase Internal Auth Admin Assigner
---------------------------------------------------------
Finds users in the Supabase authentication database pointed to by
ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL and assigns them admin access.

If the credential is missing, outputs a clear diagnostic warning message.

Usage:
    python3 scripts/auth/assign-admin.py
    python3 scripts/auth/assign-admin.py --email "admin@zolexora.com"
    python3 scripts/auth/assign-admin.py --database-url "postgresql://..."
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys

def get_database_url(arg_url: str | None = None) -> str | None:
    """Attempts to resolve the internal authentication database URL."""
    # 1. Direct CLI argument
    if arg_url:
        return arg_url.strip()

    # 2. Environment variables
    for env_var in [
        "ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL",
        "ZOLEXORA_AUTHENTICATION_DATABASE_URL",
        "SUPABASE_CORE_URL",
    ]:
        val = os.environ.get(env_var)
        if val and val.strip():
            return val.strip()

    # 3. Infisical CLI fallback lookup
    try:
        proc = subprocess.run(
            ["infisical", "secrets", "get", "ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL", "--plain", "--silent"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            return proc.stdout.strip()
    except Exception:
        pass

    return None


def print_missing_credential_message():
    """Outputs a prominent diagnostic message when the credential is missing."""
    border = "=" * 80
    print(f"\n\033[1;31m{border}\033[0m")
    print("\033[1;31m❌ [CONFIG ERROR] ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL IS MISSING\033[0m")
    print(f"\033[1;31m{border}\033[0m\n")
    print("The system attempted to locate the internal authentication database via:")
    print("  1. CLI argument: --database-url")
    print("  2. Environment variable: \033[1;33mZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL\033[0m")
    print("  3. Fallback variable: \033[1;33mZOLEXORA_AUTHENTICATION_DATABASE_URL\033[0m")
    print("  4. Infisical Vault: \033[1;33m/shared/ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL\033[0m\n")
    print("\033[1;36m👉 HOW TO RESOLVE:\033[0m")
    print("  Set the database URL in your terminal or .env:")
    print("    \033[1;32mexport ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL=\"postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres\"\033[0m")
    print("  Or run this script with --database-url:")
    print("    \033[1;32mpython3 scripts/auth/assign-admin.py --database-url \"postgresql://...\"\033[0m")
    print("  Or save the secret in Infisical:")
    print("    \033[1;32minfisical secrets set ZOLEXORA_AUTHENTICATION_INTERNAL_DATABASE_URL=\"...\"\033[0m\n")
    print(f"\033[1;31m{border}\033[0m\n")


async def assign_admin_in_supabase(db_url: str, target_email: str | None = None):
    """Connects to the database and promotes the target user to admin."""
    import asyncpg

    print(f"\033[1;34m[INFO] Connecting to authentication database...\033[0m")

    # Clean connection string for asyncpg
    clean_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

    # Connect with SSL fallback and disable prepared statement cache for PgBouncer/Supavisor
    try:
        conn = await asyncpg.connect(clean_url, ssl="prefer", statement_cache_size=0)
    except Exception as e:
        try:
            conn = await asyncpg.connect(clean_url, ssl="require", statement_cache_size=0)
        except Exception as ssl_err:
            print(f"\033[1;31m[ERROR] Failed to connect to database: {ssl_err}\033[0m")
            return 1

    try:
        # Check if auth.users table exists (Supabase authentication schema)
        has_auth_users = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users')"
        )

        if not has_auth_users:
            print("\033[1;33m[WARN] 'auth.users' table not found. Checking 'public.users'...\033[0m")
            # Fallback to public.users if using self-hosted schema
            has_public_users = await conn.fetchval(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')"
            )
            if not has_public_users:
                print("\033[1;31m[ERROR] Neither 'auth.users' nor 'public.users' exists in target database.\033[0m")
                return 1

            users = await conn.fetch("SELECT id, email FROM public.users LIMIT 10")
            if not users:
                print("\033[1;33m[WARN] No users currently found in public.users.\033[0m")
                return 0
            selected_user = users[0]
            print(f"\033[1;32m✔ Found user {selected_user['email']} in public.users.\033[0m")
            return 0

        # Query users in Supabase auth.users
        if target_email:
            users = await conn.fetch("SELECT id, email, raw_app_meta_data FROM auth.users WHERE email = $1", target_email)
        else:
            users = await conn.fetch("SELECT id, email, raw_app_meta_data FROM auth.users ORDER BY created_at ASC LIMIT 10")

        if not users:
            print("\033[1;33m[WARN] No registered users found in auth.users table.\033[0m")
            print("Please create/register a user first, then re-run this script to assign admin privileges.")
            return 0

        print(f"\033[1;32m✔ Found {len(users)} user(s) in auth.users:\033[0m")
        for u in users:
            print(f"   • User ID: {u['id']} | Email: {u['email']}")

        target = users[0]
        user_id = target["id"]
        user_email = target["email"]

        print(f"\n\033[1;34m[INFO] Assigning Admin access to user: {user_email} ({user_id})\033[0m")

        # 1. Update auth.users raw_app_meta_data
        app_meta = target["raw_app_meta_data"]
        if isinstance(app_meta, str):
            app_meta = json.loads(app_meta) if app_meta else {}
        elif not isinstance(app_meta, dict):
            app_meta = {}

        app_meta["role"] = "admin"
        app_meta["is_admin"] = True
        app_meta["is_commander"] = True
        app_meta["roles"] = ["admin", "superadmin", "commander"]

        await conn.execute(
            """
            UPDATE auth.users 
            SET raw_app_meta_data = $1::jsonb,
                raw_user_meta_data = raw_user_meta_data || '{"role": "admin", "is_admin": true}'::jsonb
            WHERE id = $2
            """,
            json.dumps(app_meta),
            user_id,
        )

        # 2. Check if public.platform_admins table exists and register
        has_platform_admins = await conn.fetchval(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_admins')"
        )
        if has_platform_admins:
            await conn.execute(
                """
                INSERT INTO public.platform_admins (user_id, status, created_at, updated_at)
                VALUES ($1, 'ACTIVE', NOW(), NOW())
                ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', updated_at = NOW()
                """,
                user_id,
            )
            print("   ✔ Registered in public.platform_admins")

        print(f"\n\033[1;32m🎉 SUCCESS! User '{user_email}' has been successfully granted Admin & Commander access!\033[0m\n")
        return 0

    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="Assign admin access to a user in Supabase auth database.")
    parser.add_argument("--database-url", type=str, default=None, help="Direct database connection URL")
    parser.add_argument("--email", type=str, default=None, help="Target user email to grant admin access to")
    args = parser.parse_args()

    db_url = get_database_url(args.database_url)
    if not db_url:
        print_missing_credential_message()
        sys.exit(1)

    exit_code = asyncio.run(assign_admin_in_supabase(db_url, args.email))
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
