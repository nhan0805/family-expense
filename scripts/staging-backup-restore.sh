#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${STAGING_DB_URL:-}" || -z "${RESTORE_DB_URL:-}" ]]; then
  echo 'Thiếu STAGING_DB_URL hoặc RESTORE_DB_URL; drill chưa chạy.' >&2
  exit 2
fi

if [[ "$STAGING_DB_URL" == "$RESTORE_DB_URL" ]]; then
  echo 'Từ chối chạy: STAGING_DB_URL và RESTORE_DB_URL phải là hai database khác nhau.' >&2
  exit 2
fi

if [[ "${CONFIRM_STAGING_RESTORE:-}" != 'YES' ]]; then
  echo 'Đặt CONFIRM_STAGING_RESTORE=YES để xác nhận restore vào target staging riêng, không phải production.' >&2
  exit 2
fi

command -v psql >/dev/null || { echo 'Không tìm thấy psql.' >&2; exit 2; }
command -v supabase >/dev/null || { echo 'Không tìm thấy Supabase CLI.' >&2; exit 2; }

started_at="$(date +%s)"
cleanup_backup_dir=0
if [[ -n "${BACKUP_DIR:-}" ]]; then
  mkdir -p "$BACKUP_DIR"
  backup_root="$BACKUP_DIR"
else
  backup_root="$(mktemp -d "${TMPDIR:-/tmp}/family-expense-drill.XXXXXX")"
  cleanup_backup_dir=1
fi
backup_file="$backup_root/staging-public-data.sql"

cleanup() {
  if [[ "$cleanup_backup_dir" == '1' ]]; then
    [[ ! -f "$backup_file" ]] || rm -f "$backup_file"
    rmdir "$backup_root" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo 'Bắt đầu backup/restore drill cho staging; không sử dụng production.'
source_count="$(psql "$STAGING_DB_URL" -X -Atqc "select count(*) from public.transactions where deleted_at is null;")"
if [[ ! "$source_count" =~ ^[0-9]+$ ]]; then
  echo 'Không đọc được số lượng giao dịch staging.' >&2
  exit 1
fi
target_existing_rows="$(psql "$RESTORE_DB_URL" -X -Atqc "select (select count(*) from public.families) + (select count(*) from public.transactions);")"
if [[ ! "$target_existing_rows" =~ ^[0-9]+$ ]]; then
  echo 'Không đọc được trạng thái target restore hoặc target chưa áp dụng schema.' >&2
  exit 1
fi
if [[ "$target_existing_rows" != '0' ]]; then
  echo 'Từ chối restore: target không trống (đã có family hoặc transaction). Hãy dùng target staging riêng.' >&2
  exit 2
fi

echo 'Đang tạo backup dữ liệu public staging…'
supabase db dump \
  --db-url "$STAGING_DB_URL" \
  --schema public \
  --data-only \
  --use-copy \
  --file "$backup_file"

echo 'Đang restore vào database target staging riêng…'
psql "$RESTORE_DB_URL" -X -v ON_ERROR_STOP=1 -f "$backup_file" >/dev/null

restore_count="$(psql "$RESTORE_DB_URL" -X -Atqc "select count(*) from public.transactions where deleted_at is null;")"
if [[ "$source_count" != "$restore_count" ]]; then
  echo "Restore verification thất bại: số lượng dòng không khớp (${source_count} -> ${restore_count})." >&2
  exit 1
fi

echo 'Chạy lại kiểm tra database/RLS trên target…'
supabase test db --db-url "$RESTORE_DB_URL" supabase/tests/tenant_security.sql

finished_at="$(date +%s)"
echo "Backup/restore drill thành công; transaction rows=${restore_count}; RTO_seconds=$((finished_at - started_at)); RPO=điểm backup."
if [[ -n "${BACKUP_DIR:-}" ]]; then
  echo "Backup file được giữ tại: $backup_file"
else
  echo 'Backup tạm đã được xóa sau khi xác minh.'
fi
