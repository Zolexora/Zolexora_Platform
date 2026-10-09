#!/usr/bin/env bash
set -e

MIGRATION_DIR="prisma/migrations/manual"
MIGRATION_FILE="$MIGRATION_DIR/migration.sql"
mkdir -p "$MIGRATION_DIR"

echo "🔍 Generating migration SQL from schema..."

npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$MIGRATION_FILE"

echo ""
echo "✅ SQL saved to: $MIGRATION_FILE"
echo ""
echo "Apply it via:"
echo "  supabase db query --linked --file $MIGRATION_FILE"
echo "  OR paste in Supabase SQL Editor"
echo ""
echo "Then run: npx prisma generate"
