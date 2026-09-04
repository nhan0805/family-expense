import { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  Mail,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { getCatalogDisplayName, transactionTypeLabel, type CatalogLanguage, type Transaction } from '../lib/domain';
import { formatImportCheckSummary } from '../lib/importSummary';
import { userFacingError } from '../lib/errorRecovery';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { inferImportMode, type TemplateError, type TemplateRow } from '../lib/templateTypes';

type ExportRow = Record<string, unknown>;
type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: {
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    multiple?: boolean;
  }) => Promise<Array<{ getFile: () => Promise<File> }>>;
};
const relationName = (value: unknown, language: CatalogLanguage) => {
  const relation = Array.isArray(value) ? value[0] : value;
  if (!relation || typeof relation !== 'object') return '';
  const item = relation as { name?: unknown; name_en?: unknown };
  return language === 'en'
    ? String(item.name_en || item.name || '')
    : String(item.name || '');
};

export function ImportExport() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const {
    familyId,
    currentUserEmail,
    currentUserId,
    currentUserRole,
    transactions,
    setTransactions,
    purposes,
    expenseTypes,
    paymentMethods,
  } = useApp();
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState('');
  const [templateBusy, setTemplateBusy] = useState(false);
  const [checkingFile, setCheckingFile] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState('');
  const [validRows, setValidRows] = useState<TemplateRow[]>([]);
  const [importErrors, setImportErrors] = useState<TemplateError[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setTemplateBusy(true);
    setMessage(en ? 'Creating template…' : 'Đang tạo template…');
    try {
      const { createTemplate } = await import('../lib/templateImport');
      const data = await createTemplate(purposes, expenseTypes, paymentMethods, language);
      const blob = new Blob([data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `family-expense-template-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage(en ? 'Template downloaded using the current categories.' : 'Đã tải template theo danh mục hiện tại.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : (en ? 'Could not create template.' : 'Không thể tạo template.'));
    } finally {
      setTemplateBusy(false);
    }
  };
  const processImportFile = async (file: File, input?: HTMLInputElement) => {
    if (!file) return;
    setFileError('');
    setValidRows([]);
    setImportErrors([]);
    setFileName(file.name);
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setFileName('');
      setFileError(
        en ? 'Invalid file format. Choose an .xlsx file downloaded from the app.' : 'File không đúng định dạng. Vui lòng chọn file .xlsx được tải từ ứng dụng.',
      );
      setMessage('');
      if (input) input.value = '';
      return;
    }
    setCheckingFile(true);
    setMessage(en ? 'Validating file…' : 'Đang kiểm tra file…');
    try {
      const { parseTemplate } = await import('../lib/templateImport');
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
      const duplicateCount = result.valid.filter((row) => row.duplicate).length;
      const validCount = result.valid.length - duplicateCount;
      setMessage(
        result.valid.length + result.errors.length > 0
          ? formatImportCheckSummary(
              file.name,
              validCount,
              duplicateCount,
              result.errors.length,
            )
          : (en ? 'No data rows were found in the “Giao dịch” sheet.' : 'Không tìm thấy dòng dữ liệu nào trong sheet “Giao dịch”.'),
      );
    } catch (e) {
      setValidRows([]);
      setImportErrors([]);
      const detail = e instanceof Error ? e.message : '';
      const wrongTemplate =
        detail.includes('sheet') || detail.includes('Tiêu đề cột');
      setFileError(
        wrongTemplate
          ? (en ? 'This file does not use the Family Expense template. Download a new template and do not rename the “Giao dịch” sheet or column headers.' : 'File không đúng template Family Expense. Hãy tải template mới từ ứng dụng và không đổi tên sheet “Giao dịch” hoặc tiêu đề cột.')
          : detail
            ? (en ? `Could not read Excel file: ${detail}` : `Không thể đọc file Excel: ${detail}`)
            : (en ? 'Could not read the Excel file. It may be corrupted or not a valid .xlsx file.' : 'Không thể đọc file Excel. File có thể bị hỏng hoặc không phải định dạng .xlsx hợp lệ.'),
      );
      setMessage(en ? 'Validation finished, but the file has errors to resolve.' : 'Đã kiểm tra xong nhưng file có lỗi cần xử lý.');
      if (input) input.value = '';
    } finally {
      setCheckingFile(false);
    }
  };
  const selectImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) void processImportFile(file, event.currentTarget);
  };
  const chooseImportFile = async () => {
    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      fileInputRef.current?.click();
      return;
    }
    try {
      const [handle] = await picker({
        multiple: false,
        types: [{
          description: 'Excel workbook',
          accept: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
          },
        }],
      });
      if (handle) await processImportFile(await handle.getFile());
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFileError(en ? 'Could not open the file picker. Please try again.' : 'Không thể mở bộ chọn file. Vui lòng thử lại.');
      setMessage(en ? 'Could not choose an Excel file.' : 'Không thể chọn file Excel.');
    }
  };
  const confirmImport = async () => {
    const rows = validRows.filter((r) => includeDuplicates || !r.duplicate);
    if (!rows.length) {
      setMessage(en ? 'There are no valid rows to import.' : 'Không có dòng hợp lệ để import.');
      return;
    }
    setImportBusy(true);
    setMessage(en ? 'Saving data…' : 'Đang ghi dữ liệu…');
    const payload = rows.map((row) => ({
      id: row.id || null,
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
    const importMode = inferImportMode(rows);
    if (!isSupabaseConfigured) {
      const imported = rows.map((row) => ({
        id: row.id || crypto.randomUUID(),
        familyId,
        transactionDate: row.transactionDate,
        amount: row.amount,
        transactionType: row.transactionType,
        status: row.status,
        description: row.description,
        paymentMethodId: row.paymentMethodId,
        purposeId: row.purposeId,
        expenseTypeId: row.expenseTypeId,
        note: row.note || null,
        source: 'excel_import' as const,
        sourceReference: fileName,
        aiGenerated: false,
        createdBy: currentUserId,
      }));
      setTransactions((items) => {
        const updates = new Map(imported.map((item) => [item.id, item]));
        const existingIds = new Set(items.map((item) => item.id));
        return [
          ...items.map((item) => updates.get(item.id) || item),
          ...imported.filter((item) => !existingIds.has(item.id)),
        ];
      });
      setImportBusy(false);
      setMessage(
        `${en ? 'Imported' : 'Đã import'} ${rows.length.toLocaleString('vi-VN')} ${en ? 'transactions.' : 'giao dịch.'}`,
      );
      setValidRows([]);
      setImportErrors([]);
      setFileName('');
      window.setTimeout(() => window.location.assign('/giao-dich'), 700);
      return;
    }
    const { data, error } = await supabase.rpc('import_template_transactions', {
      p_family_id: familyId,
      p_file_name: fileName,
      p_rows: payload,
      p_issues: importErrors,
      p_mode: importMode,
    });
    setImportBusy(false);
    if (error) {
      setMessage(`${en ? 'Import failed' : 'Import thất bại'}: ${userFacingError(error, en ? 'Could not save imported transactions.' : 'Không thể lưu dữ liệu import.')}`);
      return;
    }
    setMessage(
      `${en ? 'Imported' : 'Đã import'} ${Number((data as { imported?: number })?.imported || rows.length).toLocaleString('vi-VN')} ${en ? 'transactions.' : 'giao dịch.'}`,
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
          '*, purpose:purposes!transactions_purpose_same_family_fkey(name,name_en), expense_type:expense_types!transactions_expense_type_same_family_fkey(name,name_en), beneficiary:beneficiaries!transactions_beneficiary_same_family_fkey(name), payment_method:payment_methods!transactions_payment_method_same_family_fkey(name,name_en)',
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
        en ? `Loading ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} transactions…` : `Đang tải ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} giao dịch…`,
      );
    }
    if (allRows.length !== expectedTotal)
      throw new Error(
        en ? `Incomplete data: received ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} transactions. Please try again.` : `Dữ liệu chưa đầy đủ: nhận ${allRows.length.toLocaleString('vi-VN')} / ${expectedTotal.toLocaleString('vi-VN')} giao dịch. Vui lòng thử lại.`,
      );
    return allRows;
  };

  const exportData = async () => {
    setExporting(true);
    setExportMessage(en ? 'Preparing data…' : 'Đang chuẩn bị dữ liệu…');
    try {
      const XLSX = await import('xlsx');
      const cloudRows =
        isSupabaseConfigured && familyId ? await loadAllTransactions() : [];
      const rows = cloudRows.length
        ? cloudRows.map((row) => ({
            'ID giao dịch': row.id,
            Ngày: row.transaction_date,
            'Loại giao dịch': transactionTypeLabel(String(row.transaction_type ?? '')),
            'Trạng thái': row.status,
            'Nội dung': row.description,
            'Số tiền': Number(row.amount),
            'Mục đích': relationName(row.purpose, language),
            'Danh mục': relationName(row.expense_type, language),
            'Phương thức thanh toán': relationName(row.payment_method, language),
            'Ghi chú': row.note,
            Nguồn: row.source,
          }))
        : transactions
            .filter((transaction) => !transaction.deletedAt)
            .map((transaction) => ({
              'ID giao dịch': transaction.id,
              Ngày: transaction.transactionDate,
              'Loại giao dịch': transactionTypeLabel(transaction.transactionType),
              'Trạng thái': transaction.status,
              'Nội dung': transaction.description,
              'Số tiền': transaction.amount,
            'Mục đích':
                getCatalogDisplayName(purposes.find((item) => item.id === transaction.purposeId), language),
              'Danh mục':
                getCatalogDisplayName(expenseTypes.find((item) => item.id === transaction.expenseTypeId), language),
              'Phương thức thanh toán':
                getCatalogDisplayName(paymentMethods.find((item) => item.id === transaction.paymentMethodId), language),
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
        en ? `Exported ${rows.length.toLocaleString('vi-VN')} transactions with complete information.` : `Đã xuất ${rows.length.toLocaleString('vi-VN')} giao dịch với đầy đủ thông tin.`,
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
          ? (en ? `Could not export Excel file: ${detail}` : `Không thể xuất file Excel: ${detail}`)
          : (en ? 'Could not export the Excel file. Please try again or reload the page.' : 'Không thể xuất file Excel. Vui lòng thử lại hoặc tải lại trang.'),
      );
    } finally {
      setExporting(false);
    }
  };

  const sendTransactionsByEmail = async () => {
    if (!isSupabaseConfigured || !familyId) {
      setEmailMessage(en ? 'Email sending requires a Supabase connection.' : 'Tính năng gửi email cần kết nối Supabase.');
      return;
    }
    if (currentUserRole !== 'owner') {
      setEmailMessage(en ? 'Only the family owner can send the transaction list.' : 'Chỉ chủ gia đình mới có thể gửi danh sách giao dịch.');
      return;
    }
    if (!currentUserEmail) {
      setEmailMessage(en ? 'The current account email could not be found.' : 'Không tìm thấy email của tài khoản hiện tại.');
      return;
    }

    setEmailBusy(true);
    setEmailMessage(en ? 'Preparing and sending transaction list…' : 'Đang chuẩn bị và gửi danh sách giao dịch…');
    try {
      const { data, error } = await supabase.functions.invoke(
        'email-transactions',
        { body: { familyId } },
      );
      if (error) {
        let errorCode = '';
        const context = (error as { context?: unknown }).context;
        if (context instanceof Response) {
          const payload = (await context.clone().json().catch(() => null)) as {
            error?: string;
          } | null;
          errorCode = payload?.error || '';
        }
        setEmailMessage(
          errorCode === 'NO_TRANSACTIONS'
            ? (en ? 'There are no active transactions to send.' : 'Chưa có giao dịch đang hoạt động để gửi.')
            : errorCode === 'SERVER_NOT_CONFIGURED'
              ? (en ? 'Brevo is not configured on the server.' : 'Brevo chưa được cấu hình trên máy chủ.')
              : errorCode === 'RATE_LIMITED'
                ? (en ? 'The email sending limit was reached. Please try again later.' : 'Đã vượt giới hạn gửi email. Vui lòng thử lại sau.')
                : errorCode === 'FILE_TOO_LARGE'
                  ? (en ? 'The transaction list is too large to attach to an email.' : 'Danh sách giao dịch quá lớn để gửi kèm email.')
                : (en ? 'Could not send email. Check the Brevo configuration or try again later.' : 'Không thể gửi email. Hãy kiểm tra cấu hình Brevo hoặc thử lại sau.'),
        );
        return;
      }
      const count = Number(
        (data as { transactionCount?: number } | null)?.transactionCount || 0,
      );
      setEmailMessage(
        en ? `Sent ${count.toLocaleString('vi-VN')} transactions to ${currentUserEmail}.` : `Đã gửi ${count.toLocaleString('vi-VN')} giao dịch tới ${currentUserEmail}.`,
      );
    } catch {
      setEmailMessage(en ? 'Could not send email. Please try again later.' : 'Không thể gửi email. Vui lòng thử lại sau.');
    } finally {
      setEmailBusy(false);
    }
  };

  return (
    <div className="data-page space-y-6">
      <div className="page-header">
        <p className="page-kicker">{en ? 'Data center' : 'Trung tâm dữ liệu'}</p>
        <h2 className="page-title">{en ? 'Data' : 'Dữ liệu'}</h2>
        <p className="page-subtitle">{en ? 'Excel currently uses Vietnamese templates for compatibility with existing files.' : 'Excel hiện dùng template tiếng Việt để tương thích với các file hiện có.'}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {en ? 'Import, export and manage family transaction data.' : 'Nhập, xuất và quản lý dữ liệu giao dịch của gia đình.'}
        </p>
      </div>

      <section aria-labelledby="data-tools-title">
        <div className="section-header mb-3 items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#137050] dark:text-[#bd93f9]">{en ? 'Data tools' : 'Công cụ dữ liệu'}</p>
            <h3 id="data-tools-title" className="mt-1 text-lg font-extrabold">{en ? 'Import, export and share' : 'Nhập, xuất và chia sẻ'}</h3>
          </div>
          <span className="hidden text-xs text-gray-500 dark:text-gray-400 sm:inline">{en ? 'Family data' : 'Dữ liệu của gia đình'}</span>
        </div>
        <div className="data-tools-grid grid gap-4 lg:grid-cols-3">
        <DataCard
          icon={<FileSpreadsheet size={24} />}
          title={en ? 'Download template' : 'Tải template'}
          description={en ? 'Create an Excel file with categories and validation rules for 1,000 rows.' : 'Tạo file Excel có sẵn danh mục và quy tắc kiểm tra dữ liệu cho 1.000 dòng.'}
          tone="green"
        >
          <button
            className="btn-secondary inline-flex items-center justify-center gap-2"
            disabled={templateBusy}
            onClick={() => void downloadTemplate()}
          >
            <Download size={18} />
            {templateBusy ? (en ? 'Creating…' : 'Đang tạo…') : (en ? 'Download Excel template' : 'Tải template Excel')}
          </button>
        </DataCard>

        <DataCard
          icon={<Database size={24} />}
          title={en ? 'Export data' : 'Xuất dữ liệu'}
          description={en ? 'Export all data from the system.' : 'Xuất tất cả dữ liệu từ hệ thống.'}
          tone="blue"
        >
          <button
            className="btn-secondary inline-flex items-center justify-center gap-2"
            disabled={exporting}
            onClick={exportData}
          >
            <Download size={18} />
            {exporting ? (en ? 'Creating file…' : 'Đang tạo file…') : (en ? 'Download Excel file' : 'Tải file Excel đầy đủ')}
          </button>
          {exportMessage && (
            <p className="mt-3 text-sm" role="status" aria-live="polite">
              {exportMessage}
            </p>
          )}
        </DataCard>

        <DataCard
          icon={<Mail size={24} />}
          title={en ? 'Send by email' : 'Gửi qua email'}
          description={en ? 'Send all active transactions to the family owner’s account email.' : 'Gửi toàn bộ giao dịch đang hoạt động tới email tài khoản của chủ gia đình.'}
          tone="blue"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {en ? 'Recipient: ' : 'Người nhận: '}{currentUserEmail || (en ? 'unknown' : 'chưa xác định')}
          </p>
          <button
            className="btn-secondary mt-3 inline-flex items-center justify-center gap-2"
            disabled={
              emailBusy ||
              !isSupabaseConfigured ||
              !familyId ||
              currentUserRole !== 'owner'
            }
            onClick={() => void sendTransactionsByEmail()}
          >
            <Mail size={18} />
            {emailBusy ? (en ? 'Sending…' : 'Đang gửi…') : (en ? 'Send transaction list' : 'Gửi danh sách giao dịch')}
          </button>
          {emailMessage && (
            <p className="mt-3 text-sm" role="status" aria-live="polite">
              {emailMessage}
            </p>
          )}
        </DataCard>
        </div>
      </section>

      <section className="data-import-card card overflow-hidden">
        <div className="data-import-header flex items-start gap-3 border-b border-black/10 bg-[#fbfdfb] p-4 dark:border-white/10 dark:bg-white/[0.02] sm:p-5">
          <span className="data-card-icon rounded-xl bg-[#e3f2e9] p-3 text-[#145c43] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]">
            <Upload size={24} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold">{en ? 'Import transactions' : 'Import giao dịch'}</h3>
              <span className="rounded-full bg-[#e3f2e9] px-2 py-0.5 text-[11px] font-bold text-[#145c43] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]">{en ? 'Safe · confirmation required' : 'An toàn · cần xác nhận'}</span>
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {en ? 'Choose an .xlsx file downloaded from the app. Data is saved only after you review and confirm it.' : 'Chọn file .xlsx được tải từ ứng dụng. Dữ liệu chỉ được ghi sau khi bạn kiểm tra và xác nhận.'}
            </p>
          </div>
        </div>
        <div className="space-y-4 p-4 sm:p-5">
          <div
            className="data-upload-zone flex min-h-56 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#b8c9bf] bg-[#f7faf7] px-5 py-7 text-center transition hover:border-[#145c43] hover:bg-[#eef5f0] dark:border-[#6272a4] dark:bg-[#303241] dark:hover:border-[#50fa7b] dark:hover:bg-[#50fa7b0d]"
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void processImportFile(file);
            }}
          >
            <FileCheck2 className="text-[#145c43] dark:text-[#50fa7b]" size={30} />
            <span className="font-semibold">{en ? 'Choose an Excel file to validate' : 'Chọn file Excel để kiểm tra'}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {en ? 'Only .xlsx files using the Family Expense template are accepted; you can drag a file here.' : 'Chỉ nhận file .xlsx đúng template Family Expense; có thể kéo file từ Finder và thả vào đây'}
            </span>
            <button
              type="button"
              className="rounded-lg border border-[#b8c9bf] bg-white px-4 py-2 text-sm font-semibold dark:border-[#6272a4] dark:bg-[#343746]"
              onClick={() => void chooseImportFile()}
            >
              {en ? 'Choose Excel file' : 'Chọn file Excel'}
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              aria-label={en ? 'Choose Excel file to validate' : 'Chọn file Excel để kiểm tra'}
              onClick={(event) => {
                event.currentTarget.value = '';
              }}
              onChange={(event) => void selectImportFile(event)}
            />
          </div>
          {(fileName || checkingFile || fileError) && (
            <div
              className={`data-file-status min-h-14 rounded-xl border p-4 text-sm ${
                fileError
                  ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                  : 'border-[#cfe0d4] bg-[#f5faf6] text-[#245743] dark:border-[#50fa7b66] dark:bg-[#50fa7b0d] dark:text-[#50fa7b]'
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
                      ? (en ? 'Validating file…' : 'Đang kiểm tra file…')
                      : fileError
                        ? (en ? 'Could not validate file' : 'Không thể kiểm tra file')
                        : (en ? 'File validation result' : 'Kết quả kiểm tra file')}
                  </strong>
                  <span className="break-words">
                    {checkingFile
                      ? (en ? 'Please wait and do not close the page while the data is being read.' : 'Vui lòng chờ, không đóng trang trong lúc đọc dữ liệu.')
                      : fileError || message}
                  </span>
                </div>
              </div>
            </div>
          )}
          {(validRows.length > 0 || importErrors.length > 0) && (
            <>
              <div className="data-stats grid grid-cols-3">
                <Stat
                  label={en ? 'Valid' : 'Hợp lệ'}
                  value={validRows.filter((r) => !r.duplicate).length}
                />
                <Stat
                  label={en ? 'Possible duplicate' : 'Có thể trùng'}
                  value={validRows.filter((r) => r.duplicate).length}
                />
                <Stat label={en ? 'Errors' : 'Lỗi'} value={importErrors.length} />
              </div>
              {validRows.length > 0 && <p className="text-sm text-gray-600 dark:text-gray-300">{en ? `${validRows.filter((row) => row.id).length} update · ${validRows.filter((row) => !row.id).length} new. Rows with an ID are updated; rows without an ID are added.` : `${validRows.filter((row) => row.id).length} cập nhật · ${validRows.filter((row) => !row.id).length} thêm mới. Dòng có ID sẽ cập nhật, dòng không có ID sẽ được thêm mới.`}</p>}
              {validRows.some((r) => r.duplicate) && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeDuplicates}
                    onChange={(e) => setIncludeDuplicates(e.target.checked)}
                  />
                  {en ? 'Import rows that may be duplicates anyway' : 'Vẫn import các dòng có thể trùng'}
                </label>
              )}
              <div className="data-preview max-h-80 overflow-auto rounded-xl border">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="bg-[#eef2ed]">
                    <tr>
                      <th className="p-2">{en ? 'Row' : 'Dòng'}</th>
                      <th>{en ? 'Description' : 'Nội dung'}</th>
                      <th>{en ? 'Date' : 'Ngày'}</th>
                      <th>{en ? 'Amount' : 'Số tiền'}</th>
                      <th>{en ? 'Result' : 'Kết quả'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validRows.slice(0, 100).map((r) => (
                      <tr className="border-t" key={r.rowNumber}>
                        <td className="p-2">{r.rowNumber}</td>
                        <td>{r.description}</td>
                        <td>{r.transactionDate}</td>
                        <td>{r.amount.toLocaleString('vi-VN')}</td>
                        <td>{r.duplicate ? (en ? 'Possible duplicate' : 'Có thể trùng') : (en ? 'Valid' : 'Hợp lệ')}</td>
                      </tr>
                    ))}
                    {importErrors.slice(0, 100).map((r) => (
                      <tr className="border-t border-black/10 text-red-700 dark:border-white/10 dark:text-red-300" key={r.rowNumber}>
                        <td className="p-2">{r.rowNumber}</td>
                        <td colSpan={3}>{r.messages.join('; ')}</td>
                        <td>{en ? 'Error' : 'Lỗi'}</td>
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
                  ? (en ? 'Importing…' : 'Đang import…')
                  : `${en ? 'Confirm import' : 'Xác nhận import'} (${validRows.filter((r) => includeDuplicates || !r.duplicate).length})`}
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
      ? 'bg-[#e3f2e9] text-[#145c43] dark:bg-[#50fa7b1f] dark:text-[#50fa7b]'
      : 'bg-blue-50 text-blue-700 dark:bg-[#8be9fd1f] dark:text-[#8be9fd]';
  return (
    <section className="data-card card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className={`data-card-icon rounded-xl p-3 ${iconClass}`}>{icon}</span>
        <div className="data-card-content">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <p className="data-card-description mt-1 line-clamp-3 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <div className="data-card-actions">{children}</div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="data-stat rounded-xl p-3 text-center">
      <strong className="block text-xl">{value}</strong>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}
