#!/usr/bin/env bash
# Applies all migrations + seed to a scratch Postgres (with Supabase stand-ins) and runs the integrity tests.
# Usage: scripts/test-db.sh   (needs a local Postgres; set PGHOST/PGUSER as usual)
set -euo pipefail
cd "$(cd "$(dirname "$0")" && pwd)/.."
DB=${LH_TEST_DB:-lhtest}
dropdb --if-exists "$DB" && createdb "$DB"
for f in supabase/test-stubs.sql supabase/migrations/*.sql supabase/seed.sql supabase/tests/integrity.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"
done
