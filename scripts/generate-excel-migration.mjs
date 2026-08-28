/* global console */
import fs from 'node:fs/promises';
import process from 'node:process';
import * as XLSX from 'xlsx';

const input = process.argv[2];
const output = process.argv[3] || 'supabase/migrations/202608250004_excel_data.sql';
if (!input) throw new Error('Thiếu đường dẫn workbook.');
const wb = XLSX.read(await fs.readFile(input), { cellDates: true });
const ws = wb.Sheets['Giao dịch chuẩn hóa'];
if (!ws) throw new Error('Thiếu sheet Giao dịch chuẩn hóa.');
const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
const q = (value) => value == null || value === '' ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const date = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
const valid = [];
const issues = [];
for (const [index, row] of rows.entries()) {
  const messages = [];
  if (!row['Nội dung']) messages.push('Thiếu nội dung');
  if (!(Number(row['Số tiền']) > 0)) messages.push('Thiếu số tiền hoặc số tiền không dương');
  if (!row['Loại chi phí']) messages.push('Thiếu loại chi phí');
  const fatal = messages.some((x) => x !== 'Thiếu loại chi phí');
  if (messages.length) issues.push({ row: index + 2, ref: row['Mã giao dịch'], severity: fatal ? 'error' : 'warning', messages, source: row });
  if (!fatal) valid.push({ ...row, 'Loại chi phí': row['Loại chi phí'] || 'Khác' });
}
if (rows.length !== 2090 || rows.reduce((n, r) => n + Number(r['Giá trị ròng'] || 0), 0) !== 1696313649) throw new Error('Đối chiếu nguồn không khớp.');
const names = (field, source = valid) => [...new Set(source.map((r) => r[field]).filter(Boolean))];
const slug = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
const purposeSql = names('Mục đích chi').map((name, i) => `select c.family_id,${q(name)},'excel-${slug(name)}',${i} from _excel_ctx c where not exists(select 1 from public.purposes p where p.family_id=c.family_id and p.name=${q(name)})`).join('\nunion all\n');
const typeSql = names('Loại chi phí').map((name, i) => `select c.family_id,${q(name)},'excel-${slug(name)}',${i} from _excel_ctx c where not exists(select 1 from public.expense_types e where e.family_id=c.family_id and e.name=${q(name)})`).join('\nunion all\n');
const paymentSql = names('Phương thức thanh toán').map((name, i) => `select c.family_id,${q(name)},${i} from _excel_ctx c where not exists(select 1 from public.payment_methods p where p.family_id=c.family_id and p.name=${q(name)})`).join('\nunion all\n');
const txValues = valid.map((r) => `(${q(r['Mã giao dịch'])},${q(date(r['Ngày']))}::date,${q(r['Loại giao dịch'])}::public.transaction_kind,${q(r['Trạng thái'])}::public.transaction_status,${q(r['Nội dung'])},${Number(r['Số tiền'])},${q(r['Mục đích chi'])},${q(r['Loại chi phí'])},${q(r['Phương thức thanh toán'])},${q(r['Ghi chú'])})`).join(',\n');
const issueValues = issues.map((x) => `(${x.row},${q(x.ref)},${q(x.severity)},array[${x.messages.map(q).join(',')}],${q(JSON.stringify(x.source))}::jsonb)`).join(',\n');
const sql = `-- Generated from Expense Management - Chuan hoa.xlsx. Do not edit by hand.\n-- Source: 2,090 rows; insertable: 2,083; source net: 1,696,313,649 VND.\ncreate temporary table _excel_ctx(user_id uuid not null,family_id uuid not null,batch_id uuid not null) on commit drop;\ninsert into _excel_ctx\nselect u.id,coalesce((select fm.family_id from public.family_members fm where fm.user_id=u.id and fm.status='active' order by fm.created_at limit 1),gen_random_uuid()),gen_random_uuid()\nfrom (select id from auth.users order by created_at desc limit 1) u;\ndo $$begin if not exists(select 1 from _excel_ctx) then raise exception 'Không có Auth user. Hãy đăng ký/đăng nhập trước khi chạy migration Excel.';end if;end$$;\ninsert into public.families(id,name,created_by) select family_id,'Gia đình của tôi',user_id from _excel_ctx on conflict(id) do nothing;\ninsert into public.family_members(family_id,user_id,display_name,role,status) select family_id,user_id,coalesce((select email from auth.users where id=user_id),'Chủ gia đình'),'owner','active' from _excel_ctx on conflict(family_id,user_id) do update set role='owner',status='active';\ninsert into public.purposes(family_id,name,code,sort_order) ${purposeSql} on conflict(family_id,code) do nothing;\ninsert into public.expense_types(family_id,name,code,sort_order) ${typeSql} on conflict(family_id,code) do nothing;\ninsert into public.payment_methods(family_id,name,sort_order) ${paymentSql} on conflict(family_id,name) do nothing;\ninsert into public.import_batches(id,family_id,file_name,source_row_count,imported_count,skipped_count,error_count,expected_net,imported_net,status,created_by,completed_at) select batch_id,family_id,'Expense Management - Chuan hoa.xlsx',2090,2083,0,7,1696313649,1696313649,'completed',user_id,now() from _excel_ctx where not exists(select 1 from public.import_batches b where b.family_id=_excel_ctx.family_id and b.file_name='Expense Management - Chuan hoa.xlsx' and b.status='completed');\nwith src(source_reference,transaction_date,transaction_type,status,description,amount,purpose_name,expense_type_name,payment_name,note) as (values\n${txValues}\n)\ninsert into public.transactions(family_id,transaction_date,transaction_type,status,description,amount,purpose_id,expense_type_id,payment_method_id,note,created_by,updated_by,source,source_reference,ai_generated)\nselect c.family_id,s.transaction_date,s.transaction_type,s.status,s.description,s.amount,p.id,e.id,pm.id,s.note,c.user_id,c.user_id,'excel_import',s.source_reference,false from src s cross join _excel_ctx c join public.purposes p on p.family_id=c.family_id and p.name=s.purpose_name join public.expense_types e on e.family_id=c.family_id and e.name=s.expense_type_name left join public.payment_methods pm on pm.family_id=c.family_id and pm.name=s.payment_name on conflict(family_id,source,source_reference) do nothing;\nwith src(source_row,source_reference,severity,messages,source_values) as (values\n${issueValues}\n)\ninsert into public.import_issues(batch_id,family_id,source_row,source_reference,severity,messages,source_values) select c.batch_id,c.family_id,s.source_row,s.source_reference,s.severity,s.messages,s.source_values from src s cross join _excel_ctx c where exists(select 1 from public.import_batches b where b.id=c.batch_id) and not exists(select 1 from public.import_issues i where i.family_id=c.family_id and i.source_reference=s.source_reference);\n`;
await fs.writeFile(output, sql);
console.log(JSON.stringify({ output, source: rows.length, insertable: valid.length, issues: issues.length }));
