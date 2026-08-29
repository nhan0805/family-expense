import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useApp } from '../context/AppContext';
import { transactionTypeLabel, type Transaction } from '../lib/domain';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  createTemplate,
  parseTemplate,
  type TemplateError,
  type TemplateRow,
} from '../lib/templateImport';

type ExportRow = Record<string, unknown>;
const relationName = (value: unknown) => {
  const relation = Array.isArray(value) ? value[0] : value;
  return relation && typeof relation === 'object' && 'name' in relation
    ? String(relation.name || '')
    : '';
};

export function ImportExport() {
  const { familyId, transactions, purposes, expenseTypes, paymentMethods } =
    useApp();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [checkingFile, setCheckingFile] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [validRows, setValidRows] = useState<TemplateRow[]>([]);
  const [importErrors, setImportErrors] = useState<TemplateError[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);

  const downloadTemplate = async () => {
    setTemplateBusy(true);
    setMessage('Đang tạo template…');
    try {
      const data = await createTemplate(purposes, expenseTypes, paymentMethods);
      const blob = new Blob([data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-expense-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage('Đã tải template theo danh mục hiện tại.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Không thể tạo template.');
    } finally {
      setTemplateBusy(false);
    }
  };
  const selectImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setFileError('');
    setValidRows([]);
    setImportErrors([]);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileName('');
      setFileError(
        'File không đúng định dạng. Vui lòng chọn file .xlsx được tải từ ứng dụng.',
      );
      setMessage('');
      input.value = '';
      return;
    }
    setCheckingFile(true);
    setMessage('Đang kiểm tra file…');
    try {
      let duplicateTransactions = transactions;
      if (isSupabaseConfigured && familyId) {
        duplicateTransactions = [];
        const pageSize = 1000;
        for (let from = 0; ; from += pageSize) {
          const { data, error } = await supabase
            .from('transactions')
            .select('id,transaction_date,amount,description')
            .eq('family_id', familyId)
            .is('deleted_at', null)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const batch = data || [];
          duplicateTransactions.push(
            ...batch.map(
              (row) =>
                ({
                  id: row.id,
                  transactionDate: row.transaction_date,
                  amount: Number(row.amount),
                  description: row.description,
                  transactionType: 'Chi tiêu',
                  status: 'Thực tế',
                  purposeId: '',
                  expenseTypeId: '',
                  source: 'manual',
                  aiGenerated: false,
                }) satisfies Transaction,
            ),
          );
          if (batch.length < pageSize) break;
        }
      }
      const result = await parseTemplate(
        await file.arrayBuffer(),
        purposes,
        expenseTypes,
        paymentMethods,
        duplicateTransactions,
      );
      setValidRows(result.valid);
      setImportErrors(result.errors);
      setMessage(
        result.valid.length + result.errors.length > 0
          ? `Đã kiểm tra ${result.valid.length + result.errors.length} dòng.`
          : 'Không tìm thấy dòng dữ liệu nào trong sheet “Giao dịch”.',
      );
    } catch (e) {
      setFileName('');
      setValidRows([]);
      setImportErrors([]);
      setMessage('Không thể kiểm tra file Excel.');
      const detail = e instanceof Error ? e.message : '';
      const wrongTemplate =
        detail.includes('sheet') || detail.includes('Tiêu đề cột');
      setFileError(
        wrongTemplate
          ? 'File không đúng template Family Expense. Hãy tải template mới từ ứng dụng và không đổi tên sheet “Giao dịch” hoặc tiêu đề cột.'
          : detail
            ? `Không thể đọc file Excel: ${detail}`
            : 'Không thể đọc file Excel. File có thể bị hỏng hoặc không phải định dạng .xlsx hợp lệ.',
      );
      input.value = '';
    } finally {
      setCheckingFile(false);
    }
  };
  const confirmImport = async () => {
    const rows = validRows.filter((r) => includeDuplicates || !r.duplicate);
    if (!rows.length) {
      setMessage('Không có dòng hợp lệ để import.');
      return;
    }
    setImportBusy(true);
    setMessage('Đang ghi dữ liệu…');
    const payload = rows.map((row) => ({
      rowNumber: row.rowNumber,
      transactionDate: row.transactionDate,
      amount: row.amount,
      transactionType: row.transactionType,
      status: row.status,
      description: row.description,
      paymentMethodId: row.paymentMethodId,
      purposeId: row.purposeId,
      expenseTypeId: row.expenseTypeId,
      note: row.note,
    }));
    const { data, error } = await supabase.rpc('import_template_transactions', {
      p_family_id: familyId,
      p_file_name: fileName,
      p_rows: payload,
      p_issues: importErrors,
    });
    setImportBusy(false);
    if (error) {
      setMessage(`Import thất bại: ${error.message}`);
      return;
    }
    setMessage(
      `Đã import ${Number((data as { imported?: number })?.imported || rows.length).toLocaleString('vi-VN')} giao dịch.`,
    );
    setValidRows([]);
    setImportErrors([]);
    setFileName('');
    window.setTimeout(() => window.location.assign('/giao-dich'), 700);
  };

  const loadAllTransactions = async () => {
    const allRows: ExportRow[] = [];
    const { count, error: countError } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('family_id', familyId)
      .is('deleted_at', null);
    if (countError) throw countError;
    const expectedTotal = count || 0;
    const batchSize = 500;
    for (let from = 0; from < expectedTotal; from += batchSize) {
      const { data, error } = await supabase
        .from('transactions')
        .select(
          '*, purpose:purposes!transactions_purpose_same_family_fkey(name), expense_type:expense_types!transactions_expense_type_same_family_fkey(name), event:events!transactions_event_same_family_fkey(name), beneficiary:beneficiaries!transactions_beneficiary_same_family_fkey(name), payment_method:payment_methods!transactions_payment_method_same_family_fkey(name), account:accounts!transactions_account_same_family_fkey(name)',
        )
        .eq('family_id', familyId)
        .is('deleted_at', null)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, from + batchSize - 1);
      if (error) throw error;
      const batch = (data || []) as ExportRow[];
      allRows.push(...batch);
      setExportMessage(
        `Đang tải ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} giao dịch…`,
      );
    }
    if (allRows.length !== expectedTotal)
      throw new Error(
        `Dữ liệu chưa đầy đủ: nhận ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} giao dịch. Vui lòng thử lại.`,
      );
    return allRows;
  };

  const exportData = async () => {
    setExporting(true);
    setExportMessage('Đang chuẩn bị dữ liệu…');
    try {
      const cloudRows =
        isSupabaseConfigured && familyId ? await loadAllTransactions() : [];
      const rows = cloudRows.length
        ? cloudRows.map((row) => ({
            Ngày: row.transaction_date,
            'Loại giao dịch': transactionTypeLabel(String(row.transaction_type ?? '')),
            'Trạng thái': row.status,
            'Nội dung': row.description,
            'Số tiền': Number(row.amount),
            'Mục đích': relationName(row.purpose),
            'Danh mục': relationName(row.expense_type),
            'Phương thức thanh toán': relationName(row.payment_method),
            'Ghi chú': row.note,
            Nguồn: row.source,
          }))
        : transactions
            .filter((transaction) => !transaction.deletedAt)
            .map((transaction) => ({
              Ngày: transaction.transactionDate,
              'Loại giao dịch': transactionTypeLabel(transaction.transactionType),
              'Trạng thái': transaction.status,
              'Nội dung': transaction.description,
              'Số tiền': transaction.amount,
            'Mục đích':
                purposes.find((item) => item.id === transaction.purposeId)
                  ?.name || '',
              'Danh mục':
                expenseTypes.find(
                  (item) => item.id === transaction.expenseTypeId,
                )?.name || '',
              'Phương thức thanh toán':
                paymentMethods.find(
                  (item) => item.id === transaction.paymentMethodId,
                )?.name || '',
              'Ghi chú': transaction.note || '',
              Nguồn: transaction.source,
            }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:A1' };
      worksheet['!freeze'] = { xSplit: 0, ySplit: 1 };
      worksheet['!cols'] = Object.keys(rows[0] || {}).map((header) => ({
        wch: Math.min(42, Math.max(14, header.length + 2)),
      }));
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Giao dịch');
      XLSX.writeFile(
        workbook,
        `family-expense-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      setExportMessage(
        `Đã xuất ${rows.length.toLocaleString('vi-VN')} giao dịch với đầy đủ thông tin.`,
      );
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String(error.message)
            : '';
      setExportMessage(
        detail
          ? `Không thể xuất file Excel: ${detail}`
          : 'Không thể xuất file Excel. Vui lòng thử lại hoặc tải lại trang.',
      );
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold">Quản lý dữ liệu</h2>
        <p className="mt-1 text-sm text-gray-500">
          Nhập, xuất và quản lý dữ liệu giao dịch của gia đình.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <DataCard
          icon={<FileSpreadsheet size={24} />}
          title="Tải template"
          description="Tạo file Excel có sẵn danh mục và quy tắc kiểm tra dữ liệu cho 1.000 dòng."
          tone="green"
        >
          <button
            className="btn-secondary inline-flex items-center justify-center gap-2"
            disabled={templateBusy}
            onClick={() => void downloadTemplate()}
          >
            <Download size={18} />
            {templateBusy ? 'Đang tạo…' : 'Tải template Excel'}
          </button>
        </DataCard>

        <DataCard
          icon={<Database size={24} />}
          title="Xuất dữ liệu"
          description="Tải toàn bộ giao dịch chưa xóa cùng thông tin phân loại, thanh toán, nguồn và dữ liệu audit."
          tone="blue"
        >
          <button
            className="btn-secondary inline-flex items-center justify-center gap-2"
            disabled={exporting}
            onClick={exportData}
          >
            <Download size={18} />
            {exporting ? 'Đang tạo file…' : 'Tải file Excel đầy đủ'}
          </button>
          {exportMessage && (
            <p className="mt-3 text-sm" role="status" aria-live="polite">
              {exportMessage}
            </p>
          )}
        </DataCard>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-start gap-3 border-b border-black/10 p-5 dark:border-white/10">
          <span className="rounded-xl bg-[#e3f2e9] p-3 text-[#145c43] dark:bg-emerald-950/50 dark:text-emerald-300">
            <Upload size={24} />
          </span>
          <div>
            <h3 className="font-bold">Import giao dịch</h3>
            <p className="mt-1 text-sm text-gray-500">
              Chọn file .xlsx được tải từ ứng dụng. Dữ liệu chỉ được ghi sau khi
              bạn kiểm tra và xác nhận.
            </p>
          </div>
        </div>
        <div className="space-y-4 p-5">
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#b8c9bf] bg-[#f7faf7] px-5 py-8 text-center transition hover:border-[#145c43] hover:bg-[#eef5f0] dark:bg-white/5">
            <FileCheck2 className="text-[#145c43]" size={30} />
            <span className="font-semibold">Chọn file Excel để kiểm tra</span>
            <span className="text-xs text-gray-500">
              Chỉ nhận file .xlsx đúng template Family Expense
            </span>
            <input
              className="w-full max-w-sm cursor-pointer rounded-lg border border-[#b8c9bf] bg-white px-3 py-2 text-sm dark:bg-[#17251f]"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label="Chọn file Excel để kiểm tra"
              onClick={(event) => {
                event.currentTarget.value = '';
              }}
              onChange={(event) => void selectImportFile(event)}
            />
          </div>
          <div
            className={`min-h-14 rounded-xl border p-4 text-sm ${
              fileError
                ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                : 'border-[#cfe0d4] bg-[#f5faf6] text-[#245743] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
            role={fileError ? 'alert' : 'status'}
            aria-live="polite"
          >
            <div className="flex items-start gap-2">
              {checkingFile ? (
                <Upload className="mt-0.5 animate-pulse" size={18} />
              ) : fileError ? (
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              ) : (
                <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
              )}
              <div className="min-w-0">
                <strong className="block">
                  {checkingFile
                    ? 'Đang kiểm tra file…'
                    : fileError
                      ? 'Không thể kiểm tra file'
                      : 'Kết quả kiểm tra file'}
                </strong>
                <span className="break-words">
                  {checkingFile
                    ? 'Vui lòng chờ, không đóng trang trong lúc đọc dữ liệu.'
                    : fileError || message || 'Chưa chọn file Excel.'}
                </span>
              </div>
            </div>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 rounded-xl bg-[#eef4ef] px-4 py-3 text-sm dark:bg-white/5">
              <CheckCircle2 className="text-[#187653]" size={18} />
              <span>
                File: <strong>{fileName}</strong>
              </span>
            </div>
          )}
          {(validRows.length > 0 || importErrors.length > 0) && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Stat
                  label="Hợp lệ"
                  value={validRows.filter((r) => !r.duplicate).length}
                />
                <Stat
                  label="Có thể trùng"
                  value={validRows.filter((r) => r.duplicate).length}
                />
                <Stat label="Lỗi" value={importErrors.length} />
              </div>
              {validRows.some((r) => r.duplicate) && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeDuplicates}
                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                  />
                  Vẫn import các dòng có thể trùng
                </label>
              )}
              <div className="max-h-80 overflow-auto rounded-xl border">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#eef2ed]">
                    <tr>
                      <th className="p-2">Dòng</th>
                      <th>Nội dung</th>
                      <th>Ngày</th>
                      <th>Số tiền</th>
                      <th>Kết quả</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 100).map((r) => (
                      <tr className="border-t" key={r.rowNumber}>
                        <td className="p-2">{r.rowNumber}</td>
                        <td>{r.description}</td>
                        <td>{r.transactionDate}</td>
                        <td>{r.amount.toLocaleString('vi-VN')}</td>
                        <td>{r.duplicate ? 'Có thể trùng' : 'Hợp lệ'}</td>
                      </tr>
                    ))}
                    {importErrors.slice(0, 100).map((r) => (
                      <tr className="border-t text-red-700" key={r.rowNumber}>
                        <td className="p-2">{r.rowNumber}</td>
                        <td colSpan={3}>{r.messages.join('; ')}</td>
                        <td>Lỗi</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                className="btn-primary"
                disabled={
                  importBusy ||
                  validRows.every((r) => r.duplicate && !includeDuplicates)
                }
                onClick={() => void confirmImport()}
              >
                {importBusy
                  ? 'Đang import…'
                  : `Xác nhận import (${validRows.filter((r) => includeDuplicates || !r.duplicate).length})`}
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function DataCard({
  icon,
  title,
  description,
  tone,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'green' | 'blue';
  children: React.ReactNode;
}) {
  const iconClass =
    tone === 'green'
      ? 'bg-[#e3f2e9] text-[#145c43] dark:bg-emerald-950/50 dark:text-emerald-300'
      : 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300';
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className={`rounded-xl p-3 ${iconClass}`}>{icon}</span>
        <div>
          <h3 className="font-bold">{title}</h3>
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#eef4ef] p-3 text-center dark:bg-white/5">
      <strong className="block text-xl">{value}</strong>
      <span className="text-xs text-gray-500">{label}</span>
    </div>
  );
}
