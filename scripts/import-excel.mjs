/* global console */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_COUNT = 2090;
const EXPECTED_NET = 1696313649;
const BATCH_SIZE = 200;
const inputPath = process.argv.find((arg) => arg.endsWith('.xlsx'));
const commit = process.argv.includes('--commit');
if (!inputPath) throw new Error('Cách dùng: node scripts/import-excel.mjs "/path/file.xlsx" [--commit]');

const slug = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const isoDate = (value) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') { const d = XLSX.SSF.parse_date_code(value); return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`; }
  const matched = String(value ?? '').match(/(\d{4})-(\d{2})-(\d{2})/);
  return matched ? `${matched[1]}-${matched[2]}-${matched[3]}` : null;
};
const netValue = (row) => Number.isFinite(Number(row['Giá trị ròng'])) ? Number(row['Giá trị ròng']) : row['Loại giao dịch'] === 'Hoàn tiền' ? -Number(row['Số tiền'] || 0) : row['Loại giao dịch'] === 'Chi tiêu' ? Number(row['Số tiền'] || 0) : 0;
const sourceBuffer = await fs.readFile(inputPath);
const workbook = XLSX.read(sourceBuffer, { cellDates: true });
const sheet = workbook.Sheets['Giao dịch chuẩn hóa'];
if (!sheet) throw new Error('Không tìm thấy sheet “Giao dịch chuẩn hóa”.');
const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
const issues = [];
const validRows = [];

for (const [index, row] of rows.entries()) {
  const messages = [];
  if (!isoDate(row['Ngày'])) messages.push('Thiếu hoặc sai ngày');
  if (!String(row['Nội dung'] ?? '').trim()) messages.push('Thiếu nội dung');
  if (!(Number(row['Số tiền']) > 0)) messages.push('Thiếu số tiền hoặc số tiền không dương');
  if (!row['Mục đích chi']) messages.push('Thiếu mục đích chi');
  if (!row['Loại chi phí']) messages.push('Thiếu loại chi phí');
  if (messages.some((message) => !message.startsWith('Thiếu loại chi phí'))) {
    issues.push({ source_row: index + 2, source_reference: row['Mã giao dịch'], severity: 'error', messages, source_values: row });
    continue;
  }
  if (messages.length) issues.push({ source_row: index + 2, source_reference: row['Mã giao dịch'], severity: 'warning', messages: [...messages, 'Sẽ map loại chi phí sang Khác'], source_values: row });
  validRows.push({ ...row, 'Loại chi phí': row['Loại chi phí'] || 'Khác', __sourceRow: index + 2 });
}

const summary = { sourceRows: rows.length, validRows: validRows.length, reviewRows: issues.length, errorRows: issues.filter((x) => x.severity === 'error').length, sourceNet: rows.reduce((sum, row) => sum + netValue(row), 0), validNet: validRows.reduce((sum, row) => sum + netValue(row), 0) };
console.log(JSON.stringify(summary, null, 2));
if (summary.sourceRows !== EXPECTED_COUNT || summary.sourceNet !== EXPECTED_NET) throw new Error(`Đối chiếu nguồn thất bại; cần ${EXPECTED_COUNT} dòng và ${EXPECTED_NET} VND.`);
if (!commit) { console.log('Dry-run đạt. Thêm --commit để ghi vào Supabase.'); process.exit(0); }

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const familyId = process.env.FAMILY_ID;
if (!url || !anonKey || !accessToken || !familyId) throw new Error('Thiếu SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_ACCESS_TOKEN hoặc FAMILY_ID.');
const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${accessToken}` } }, auth: { persistSession: false } });
const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
if (userError || !userData.user) throw new Error('Access token Supabase không hợp lệ.');
const userId = userData.user.id;
const { data: member } = await supabase.from('family_members').select('id,role').eq('family_id', familyId).eq('user_id', userId).eq('status', 'active').maybeSingle();
if (!member || member.role !== 'owner') throw new Error('Chỉ owner của family được chạy migration Excel.');

const unique = (field) => [...new Set(validRows.map((row) => row[field]).filter(Boolean))];
const upsertCatalog = async (table, names, extra = {}) => {
  if (!names.length) return new Map();
  const { data: existing, error: existingError } = await supabase.from(table).select('id,name').eq('family_id', familyId);
  if (existingError) throw existingError;
  const existingNames = new Set(existing.map((item) => item.name));
  const missingNames = names.filter((name) => !existingNames.has(name));
  const ordered = new Set(['purposes', 'expense_types', 'payment_methods']);
  const payload = missingNames.map((name, sort_order) => ({ family_id: familyId, name, ...extra, ...(ordered.has(table) ? { sort_order: existing.length + sort_order } : {}), ...(table === 'purposes' || table === 'expense_types' ? { code: `excel-${slug(name)}` } : {}) }));
  const conflict = table === 'purposes' || table === 'expense_types' ? 'family_id,code' : 'family_id,name';
  if (payload.length) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: conflict, ignoreDuplicates: true });
    if (error) throw error;
  }
  const { data, error: readError } = await supabase.from(table).select('id,name').eq('family_id', familyId);
  if (readError) throw readError;
  return new Map(data.map((item) => [item.name, item.id]));
};

const purposes = await upsertCatalog('purposes', unique('Mục đích chi'));
const expenseTypes = await upsertCatalog('expense_types', unique('Loại chi phí'));
const paymentMethods = await upsertCatalog('payment_methods', unique('Phương thức thanh toán'));
const beneficiaries = await upsertCatalog('beneficiaries', unique('Người hưởng lợi'));
const events = await upsertCatalog('events', unique('Sự kiện/Kế hoạch'));
const accounts = await upsertCatalog('accounts', unique('Tài khoản/Thẻ'), { account_type: 'legacy' });

const { data: batch, error: batchError } = await supabase.from('import_batches').insert({ family_id: familyId, file_name: path.basename(inputPath), source_row_count: rows.length, expected_net: summary.sourceNet, status: 'processing', created_by: userId }).select('id').single();
if (batchError) throw batchError;
if (issues.length) {
  const { error } = await supabase.from('import_issues').insert(issues.map((issue) => ({ ...issue, batch_id: batch.id, family_id: familyId })));
  if (error) throw error;
}

let imported = 0;
for (let start = 0; start < validRows.length; start += BATCH_SIZE) {
  const payload = validRows.slice(start, start + BATCH_SIZE).map((row) => ({ family_id: familyId, transaction_date: isoDate(row['Ngày']), transaction_type: row['Loại giao dịch'], status: row['Trạng thái'], description: String(row['Nội dung']).trim(), amount: Number(row['Số tiền']), purpose_id: purposes.get(row['Mục đích chi']), expense_type_id: expenseTypes.get(row['Loại chi phí']), event_id: events.get(row['Sự kiện/Kế hoạch']) || null, beneficiary_id: beneficiaries.get(row['Người hưởng lợi']) || null, payment_method_id: paymentMethods.get(row['Phương thức thanh toán']) || null, account_id: accounts.get(row['Tài khoản/Thẻ']) || null, note: row['Ghi chú'], created_by: userId, updated_by: userId, source: 'excel_import', source_reference: row['Mã giao dịch'], ai_generated: false }));
  const { data, error } = await supabase.from('transactions').upsert(payload, { onConflict: 'family_id,source,source_reference', ignoreDuplicates: true }).select('id');
  if (error) throw error;
  imported += data.length;
  console.log(`Đã xử lý ${Math.min(start + BATCH_SIZE, validRows.length)}/${validRows.length}`);
}
await supabase.from('import_batches').update({ imported_count: imported, skipped_count: validRows.length - imported, error_count: summary.errorRows, imported_net: summary.validNet, status: 'completed', completed_at: new Date().toISOString() }).eq('id', batch.id);
console.log(JSON.stringify({ batchId: batch.id, imported, skippedAsDuplicate: validRows.length - imported, review: issues.length, net: summary.validNet }, null, 2));
