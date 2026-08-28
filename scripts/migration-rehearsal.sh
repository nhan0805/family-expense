#!/usr/bin/env bash
set -euo pipefail

echo 'Migration rehearsal: chạy trên Supabase staging, không chạy production.'
echo '1) supabase link --project-ref <staging-project-ref>'
echo '2) supabase db push --dry-run'
echo '3) supabase db push'
echo '4) supabase db diff --linked và kiểm tra RLS/RPC/foreign keys'
echo '5) chạy smoke test và đối chiếu số liệu trước khi xin approval production.'
echo 'Production chỉ thực hiện sau khi có approval bằng văn bản và backup xác nhận.'
