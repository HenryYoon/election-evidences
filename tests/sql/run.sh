#!/usr/bin/env bash
# SQL 검사. PG* 환경변수(또는 기본 소켓)로 빈 Postgres에 접속한다.
# 1) 스키마 파일 전체를 두 번 적용하고 RLS를 검사한다.
# 2) 운영 기준 스키마에 마이그레이션 0001~0004(각각 두 번)을 적용하고 결과를 검사한다.
set -euo pipefail
cd "$(dirname "$0")/../.."
fresh() { psql -X -q -d postgres -c "drop database if exists $1" -c "create database $1"; }
run() {
  local db=$1; shift
  local args=() out
  for f in "$@"; do args+=(-f "$f"); done
  if ! out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$db" "${args[@]}" 2>&1); then
    echo "$out" | grep -v "skipping\|already exists"
    echo "SQL 검사 실패: $db" >&2
    exit 1
  fi
  echo "$out" | grep -o "ok: .*" || true
}

fresh desk_schema
run desk_schema tests/sql/supabase_stub.sql scripts/supabase_schema.sql scripts/supabase_schema.sql tests/sql/rls_test.sql tests/sql/tip_test.sql

fresh desk_migrate
run desk_migrate tests/sql/supabase_stub.sql tests/sql/prod_baseline.sql tests/sql/backfill_seed.sql \
  scripts/migrations/0001_ledger_and_admins.sql scripts/migrations/0002_ledger_backfill.sql \
  scripts/migrations/0002_ledger_backfill.sql tests/sql/backfill_test.sql \
  scripts/migrations/0003_claims_dedupe_unmask.sql scripts/migrations/0003_claims_dedupe_unmask.sql \
  tests/sql/migration_0003_test.sql \
  scripts/migrations/0004_tip_intake.sql scripts/migrations/0004_tip_intake.sql tests/sql/tip_test.sql
echo "SQL 검사 통과"
