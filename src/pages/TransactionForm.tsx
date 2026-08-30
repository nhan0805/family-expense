import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, LoaderCircle, Mic, MicOff, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import {
  canDeleteTransaction,
  findDuplicates,
  statusForTransactionDate,
  transactionSchema,
  type TransactionInput,
  type TransactionFormInput,
} from '../lib/domain';
import { aiResponseSchema } from '../lib/ai';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { fetchTransaction } from '../lib/transactionsApi';
import { PageSkeleton } from '../components/AsyncStates';
import { useFeedback } from '../components/Feedback';
import { userFacingError } from '../lib/errorRecovery';
import {
  clearTransactionDraft,
  readTransactionDraft,
  saveTransactionDraft,
} from '../lib/transactionDraft';

type AiFieldKey =
  | 'transactionDate'
  | 'description'
  | 'amount'
  | 'transactionType'
  | 'status'
  | 'purposeId'
  | 'expenseTypeId'
  | 'paymentMethodId';
type AiTone = 'suggestion' | 'warning' | null;

const aiFieldLabels: Record<AiFieldKey, string> = {
  transactionDate: 'Ngày',
  description: 'Nội dung',
  amount: 'Số tiền',
  transactionType: 'Loại giao dịch',
  status: 'Trạng thái',
  purposeId: 'Mục đích',
  expenseTypeId: 'Danh mục',
  paymentMethodId: 'Phương thức thanh toán',
};

type AiResult = {
  fields: AiFieldKey[];
  confidence: number;
  warnings: string[];
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
};

type SpeechRecognitionErrorLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition() {
  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}
export function TransactionForm() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const { askConfirm, notify } = useFeedback();
  const queryClient = useQueryClient();
  const { id } = useParams();
  const nav = useNavigate();
  const {
    transactions,
    setTransactions,
    purposes,
    expenseTypes,
    paymentMethods,
    familyId,
    currentUserId,
    currentUserRole,
    online = true,
  } = useApp();
  const localExisting = transactions.find((t) => t.id === id);
  const existingQuery = useQuery({
    queryKey: ['transaction', familyId, id],
    queryFn: () => fetchTransaction(familyId, id!),
    enabled: isSupabaseConfigured && Boolean(familyId && id),
  });
  const existing = isSupabaseConfigured ? existingQuery.data : localExisting;
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [aiResultVisible, setAiResultVisible] = useState(true);
  const [aiCompleted, setAiCompleted] = useState(false);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported] = useState(() => Boolean(getSpeechRecognition()));
  const speechRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(Boolean(localExisting?.note));
  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<TransactionFormInput, unknown, TransactionInput>({
    resolver: zodResolver(transactionSchema),
    defaultValues: existing ?? {
      transactionDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
      transactionType: 'Chi tiêu',
      status: 'Thực tế',
      description: '',
      amount: undefined,
      purposeId: '',
      expenseTypeId: '',
      paymentMethodId:
        paymentMethods.find((method) => method.name === 'Chuyển khoản')?.id ??
        '',
      source: 'manual',
      aiGenerated: false,
    },
  });
  const watchedForm = useWatch({ control });
  const [draftRestored, setDraftRestored] = useState(false);
  const draftCheckedFamilyRef = useRef('');
  useEffect(() => {
    if (id || !familyId || draftCheckedFamilyRef.current === familyId) return;
    draftCheckedFamilyRef.current = familyId;
    const draft = readTransactionDraft(familyId);
    setDraftRestored(false);
    if (draft) {
      reset(draft);
      setDraftRestored(true);
    }
  }, [familyId, id, reset]);
  useEffect(() => {
    if (id || !familyId || !isDirty) return;
    saveTransactionDraft(familyId, watchedForm);
  }, [familyId, id, isDirty, watchedForm]);
  useEffect(() => {
    if (existing) {
      reset(existing);
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
      if (
        existing.note ||
        existing.status !== statusForTransactionDate(existing.transactionDate, today)
      ) setExtrasOpen(true);
    }
  }, [existing, reset]);
  const transactionDate = watch('transactionDate');
  const description = watch('description') || '';
  useEffect(() => {
    if (id || !transactionDate) return;
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    setValue('status', statusForTransactionDate(transactionDate, today), {
      shouldValidate: true,
    });
  }, [id, setValue, transactionDate]);
  useEffect(() => () => speechRecognitionRef.current?.stop(), []);
  const onSubmit = async (data: TransactionInput) => {
    if (isSupabaseConfigured && !online) {
      setSaveError('Đang mất kết nối mạng. Bản nháp đã được lưu trên thiết bị; hãy kết nối lại rồi thử lại.');
      return;
    }
    let duplicateCount = 0;
    if (isSupabaseConfigured) {
      let duplicateQuery = supabase
        .from('transactions')
        .select('id,transaction_date,amount,description')
        .eq('family_id', familyId)
        .eq('transaction_date', data.transactionDate)
        .eq('amount', data.amount)
        .is('deleted_at', null);
      if (id) duplicateQuery = duplicateQuery.neq('id', id);
      const { data: candidates, error: duplicateError } = await duplicateQuery;
      if (duplicateError) {
        setSaveError(userFacingError(duplicateError, 'Không thể kiểm tra giao dịch trùng.'));
        return;
      }
      duplicateCount = findDuplicates(
        data,
        (candidates || []).map((candidate) => ({
          ...data,
          id: candidate.id,
          transactionDate: candidate.transaction_date,
          amount: Number(candidate.amount),
          description: candidate.description,
        })),
      ).length;
    } else
      duplicateCount = findDuplicates(
        data,
        transactions.filter((t) => t.id !== id),
      ).length;
    if (duplicateCount && !await askConfirm({ title: 'Giao dịch có thể bị trùng', description: `Tìm thấy ${duplicateCount} giao dịch tương tự về ngày, nội dung và số tiền. Bạn vẫn muốn lưu?`, confirmLabel: 'Vẫn lưu' })) return;
    setSaveBusy(true);
    setSaveError('');
    if (isSupabaseConfigured) {
      const payload = {
        family_id: familyId,
        transaction_date: data.transactionDate,
        transaction_type: data.transactionType,
        status: data.status,
        description: data.description,
        amount: data.amount,
        purpose_id: data.purposeId,
        expense_type_id: data.expenseTypeId,
        event_id: data.eventId || null,
        beneficiary_id: data.beneficiaryId || null,
        payment_method_id: data.paymentMethodId || null,
        account_id: data.accountId || null,
        note: data.note || null,
        source: data.source,
        source_reference: data.sourceReference || null,
        ai_generated: data.aiGenerated,
        updated_by: currentUserId,
      };
      const result = id
        ? await supabase
            .from('transactions')
            .update(payload)
            .eq('id', id)
            .eq('family_id', familyId)
            .select('id,created_at')
            .single()
        : await supabase
            .from('transactions')
            .insert({ ...payload, created_by: currentUserId })
            .select('id,created_at')
            .single();
      if (result.error || !result.data) {
        setSaveBusy(false);
        setSaveError(userFacingError(result.error, 'Không thể lưu giao dịch vào database.'));
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: ['transactions', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['transaction-years', familyId],
      });
    } else {
      setTransactions((items) =>
        id
          ? items.map((item) => (item.id === id ? { ...item, ...data } : item))
          : [{ ...data, id: crypto.randomUUID() }, ...items],
      );
    }
    if (isSupabaseConfigured) clearTransactionDraft(familyId);
    else if (!id) clearTransactionDraft(familyId);
    setSaveBusy(false);
    notify(id ? 'Đã cập nhật giao dịch.' : 'Đã thêm giao dịch mới.');
    nav('/giao-dich');
  };
  const deleteTransaction = async () => {
    if (
      !existing ||
      !canDeleteTransaction(existing, currentUserRole, currentUserId)
    ) {
      setSaveError('Bạn chỉ có thể xóa giao dịch do chính mình tạo.');
      return;
    }
    if (!await askConfirm({ title: 'Xóa giao dịch?', description: `Giao dịch “${existing.description}” sẽ được chuyển vào trạng thái đã xóa.`, confirmLabel: 'Xóa giao dịch', danger: true })) return;
    if (isSupabaseConfigured && !online) {
      setSaveError('Đang mất kết nối mạng. Hãy kết nối lại rồi thử lại thao tác xóa.');
      return;
    }
    const deletedAt = new Date().toISOString();
    setDeleteBusy(true);
    setSaveError('');
    if (isSupabaseConfigured) {
      let query = supabase
        .from('transactions')
        .update({ deleted_at: deletedAt, updated_by: currentUserId })
        .eq('id', existing.id)
        .eq('family_id', familyId)
        .is('deleted_at', null);
      if (currentUserRole === 'member')
        query = query.eq('created_by', currentUserId);
      const { data, error } = await query.select('id').maybeSingle();
      if (error || !data) {
        setDeleteBusy(false);
        setSaveError(userFacingError(error, 'Không thể xóa giao dịch. Bạn có thể không có quyền hoặc giao dịch đã bị xóa.'));
        return;
      }
    }
    if (isSupabaseConfigured) {
      await queryClient.invalidateQueries({
        queryKey: ['transactions', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', familyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ['transaction-years', familyId],
      });
      queryClient.removeQueries({
        queryKey: ['transaction', familyId, existing.id],
      });
    } else
      setTransactions((items) =>
        items.map((item) =>
          item.id === existing.id ? { ...item, deletedAt } : item,
        ),
      );
    setDeleteBusy(false);
    notify('Đã xóa giao dịch.');
    nav('/giao-dich');
  };
  const parseAi = async () => {
    if (!description.trim()) return;
    if (!online) {
      notify('Đang mất kết nối mạng. Hãy kết nối lại trước khi dùng AI.', 'error');
      return;
    }
    setAiBusy(true);
    setAiCompleted(false);
    setAiResult(null);
    setAiResultVisible(true);
    try {
      if (!isSupabaseConfigured)
        throw new Error('Hãy cấu hình Supabase để sử dụng Gemini.');
      const { data, error } = await supabase.functions.invoke('parse-expense', {
        body: { text: description, familyId, timezone: 'Asia/Ho_Chi_Minh' },
      });
      if (error) throw error;
      const s = aiResponseSchema.parse(data).suggestion;
      const filledFields: AiFieldKey[] = [
        'transactionDate',
        'description',
        'transactionType',
        'status',
      ];
      setValue('transactionDate', s.date, { shouldValidate: true });
      setValue('description', s.description, { shouldValidate: true });
      if (s.amount) {
        setValue('amount', s.amount, { shouldValidate: true });
        filledFields.push('amount');
      }
      setValue('transactionType', s.transactionType, { shouldValidate: true });
      setValue('status', s.status, { shouldValidate: true });
      if (s.purposeId) {
        setValue('purposeId', s.purposeId, { shouldValidate: true });
        filledFields.push('purposeId');
      }
      if (s.expenseTypeId) {
        setValue('expenseTypeId', s.expenseTypeId, { shouldValidate: true });
        filledFields.push('expenseTypeId');
      }
      if (s.paymentMethodId) {
        setValue('paymentMethodId', s.paymentMethodId, { shouldValidate: true });
        filledFields.push('paymentMethodId');
      }
      setValue('source', 'ai');
      setValue('aiGenerated', true);
      setAiResult({ fields: filledFields, confidence: s.confidence, warnings: s.warnings });
      setAiCompleted(true);
      window.setTimeout(() => setAiCompleted(false), 1800);
      const missingAmount = s.amount === null;
      notify(
        missingAmount
          ? 'AI đã điền một phần thông tin. Còn thiếu Số tiền.'
          : `AI đã đề xuất ${filledFields.length} trường. Hãy kiểm tra trước khi lưu.`,
        missingAmount || s.warnings.length ? 'info' : 'success',
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      const rateLimited = /429|rate limit|too many requests/i.test(message);
      notify(
        rateLimited
          ? 'AI đang đạt giới hạn sử dụng. Vui lòng thử lại sau.'
          : 'Không thể phân tích lúc này. Nội dung của bạn vẫn được giữ nguyên.',
        'error',
      );
    } finally {
      setAiBusy(false);
    }
  };
  const toggleVoiceInput = () => {
    if (voiceListening) {
      speechRecognitionRef.current?.stop();
      setVoiceListening(false);
      return;
    }
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      notify('Trình duyệt này chưa hỗ trợ nhập bằng giọng nói.', 'info');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'vi-VN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .filter((result) => result.isFinal)
        .map((result) => result[0].transcript.trim())
        .filter(Boolean)
        .join(' ');
      if (!transcript) return;
      const currentDescription = watch('description')?.trim() ?? '';
      setValue('description', [currentDescription, transcript].filter(Boolean).join(' '), {
        shouldDirty: true,
        shouldValidate: true,
      });
      notify('Đã chuyển giọng nói thành nội dung. Hãy kiểm tra trước khi dùng AI.', 'success');
    };
    recognition.onerror = (event) => {
      const permissionDenied = event.error === 'not-allowed' || event.error === 'service-not-allowed';
      notify(
        permissionDenied
          ? 'Chưa được cấp quyền micro. Hãy cho phép trong cài đặt trình duyệt.'
          : 'Không nhận dạng được giọng nói. Vui lòng thử lại hoặc nhập bằng bàn phím.',
        'error',
      );
      setVoiceListening(false);
    };
    recognition.onend = () => setVoiceListening(false);
    speechRecognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceListening(true);
    } catch {
      setVoiceListening(false);
      notify('Không thể bật micro lúc này. Vui lòng thử lại.', 'error');
    }
  };
  const aiTone: AiTone = aiResult ? (aiResult.confidence < 0.9 ? 'warning' : 'suggestion') : null;
  const aiFieldProps = (field: AiFieldKey) => ({
    aiSuggested: Boolean(aiResultVisible && aiResult?.fields.includes(field)),
    aiTone,
  });
  if (id && isSupabaseConfigured && existingQuery.isPending)
    return <PageSkeleton label="Đang tải thông tin giao dịch…"/>;
  if (id && isSupabaseConfigured && (existingQuery.isError || !existing))
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-700">
        Không tìm thấy giao dịch hoặc bạn không có quyền truy cập.
      </p>
    );
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <p className="text-sm text-gray-500">{en ? 'Transaction' : 'Giao dịch'}</p>
        <h2 className="text-2xl font-extrabold">
          {id ? 'Sửa giao dịch' : 'Thêm giao dịch'}
        </h2>
      </div>
      <form
        className="card grid gap-4 p-5 md:grid-cols-3"
        onSubmit={handleSubmit(onSubmit)}
      >
          <p className="text-xs text-gray-500 md:col-span-3">
            {en ? 'Fields marked with ' : 'Các trường có '}<span className="font-bold text-red-600">*</span>{en ? ' are required.' : ' là bắt buộc.'}
            bắt buộc.
          </p>
          <div className="md:col-span-3"><h3 className="font-bold">{en ? 'Basic information' : 'Thông tin chính'}</h3><p className="text-xs text-gray-500">{en ? 'Enter the information needed to record this transaction.' : 'Nhập các thông tin cần thiết để ghi nhận giao dịch.'}</p></div>
          <div className="md:col-span-3">
            <label className="label flex items-center gap-2" htmlFor="transaction-description">
              <span>{en ? 'Description' : 'Nội dung'} <span className="text-red-600" aria-hidden="true">*</span></span>
              <AiBadge {...aiFieldProps('description')} />
            </label>
            <div className="flex items-stretch gap-2">
              <div className="relative min-w-0 flex-1">
                <input
                  id="transaction-description"
                  className={`field field-with-trailing-action min-w-0 ${aiFieldClass(aiFieldProps('description'))}`}
                  required
                  {...register('description')}
                />
                {voiceSupported && (
                  <button
                    type="button"
                    className={`absolute inset-y-1 right-1 grid aspect-square place-items-center rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-violet-300 ${voiceListening ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : 'text-gray-500 hover:bg-gray-100 hover:text-violet-700 dark:text-gray-300 dark:hover:bg-white/10'}`}
                    aria-label={voiceListening ? 'Dừng nhập bằng giọng nói' : 'Nhập nội dung bằng giọng nói'}
                    aria-pressed={voiceListening}
                    title={voiceListening ? 'Dừng nghe' : 'Nhập bằng giọng nói'}
                    onClick={toggleVoiceInput}
                  >
                    {voiceListening ? <MicOff className="animate-pulse" size={19} /> : <Mic size={19} />}
                  </button>
                )}
              </div>
              <button
                type="button"
                className={`flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-xl px-3 font-bold text-white shadow-sm transition-all focus:outline-none focus:ring-4 focus:ring-violet-300/40 disabled:cursor-not-allowed disabled:bg-none disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none dark:disabled:bg-gray-700 dark:disabled:text-gray-400 ${aiCompleted ? 'bg-emerald-600' : 'bg-gradient-to-r from-violet-600 to-sky-500 hover:from-violet-700 hover:to-sky-600'}`}
                aria-label="Phân tích nội dung bằng AI"
                title="Phân tích nội dung bằng AI"
                disabled={aiBusy || !description.trim()}
                onClick={() => void parseAi()}
              >
                {aiBusy ? <LoaderCircle className="animate-spin" size={18} /> : aiCompleted ? <Check size={18} /> : <Sparkles size={18} />}
                <span className="hidden sm:inline">{aiBusy ? 'Đang phân tích…' : aiCompleted ? 'Đã điền' : 'Gợi ý AI'}</span>
              </button>
            </div>
            {errors.description?.message && <span className="mt-1 block text-xs text-red-600">{errors.description.message}</span>}
            <p className="mt-1 text-xs text-gray-500">Nhập tay hoặc dùng micro để chuyển giọng nói thành chữ, sau đó nhấn AI nếu cần. App không lưu audio và gợi ý không được tự động lưu.</p>
          </div>
          {aiResult && aiResultVisible && (
            <section className={`ui-enter rounded-xl border p-4 md:col-span-3 ${aiTone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100' : 'border-violet-200 bg-gradient-to-r from-violet-50 to-sky-50 text-violet-950 dark:border-violet-800 dark:from-violet-950/35 dark:to-sky-950/25 dark:text-violet-100'}`} aria-label="Tóm tắt gợi ý AI">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 shrink-0" size={19} />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">AI đã đề xuất {aiResult.fields.length} trường</p>
                  <p className="mt-1 text-sm">{aiResult.fields.map((field) => aiFieldLabels[field]).join(', ')}.</p>
                  <p className="mt-2 text-xs font-semibold">Độ tin cậy: {Math.round(aiResult.confidence * 100)}%. Hãy kiểm tra trước khi lưu.</p>
                  {aiResult.warnings.length > 0 && <ul className="mt-2 list-disc pl-5 text-sm" role="alert">{aiResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>}
                </div>
                <button type="button" className="rounded-lg p-1.5 hover:bg-black/5 dark:hover:bg-white/10" aria-label="Ẩn tóm tắt và đánh dấu AI" onClick={() => setAiResultVisible(false)}><X size={18} /></button>
              </div>
            </section>
          )}
          <Field label="Ngày" required error={errors.transactionDate?.message} {...aiFieldProps('transactionDate')}>
            <input
              type="date"
              className={`field ${aiFieldClass(aiFieldProps('transactionDate'))}`}
              required
              {...register('transactionDate')}
            />
          </Field>
          <Field label="Số tiền (VND)" required error={errors.amount?.message} {...aiFieldProps('amount')}>
            <Controller
              name="amount"
              control={control}
              render={({ field }) => (
                <input
                  ref={field.ref}
                  name={field.name}
                  onBlur={field.onBlur}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  className={`field text-right font-semibold ${aiFieldClass(aiFieldProps('amount'))}`}
                  required
                  value={
                    typeof field.value === 'number' && field.value > 0
                      ? field.value.toLocaleString('vi-VN')
                      : ''
                  }
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    field.onChange(digits ? Number(digits) : undefined);
                  }}
                />
              )}
            />
          </Field>
          <Field label="Loại giao dịch" required {...aiFieldProps('transactionType')}>
            <select className={`field ${aiFieldClass(aiFieldProps('transactionType'))}`} required {...register('transactionType')}>
              <option value="Chi tiêu">Tiền ra</option>
              <option value="Thu nhập">Tiền vào</option>
            </select>
          </Field>
          <div className="mt-1 border-t border-black/10 pt-4 dark:border-white/10 md:col-span-3"><h3 className="font-bold">{en ? 'Classification' : 'Phân loại'}</h3><p className="text-xs text-gray-500">{en ? 'Helps keep the dashboard and reports accurate.' : 'Giúp Dashboard và báo cáo tổng hợp chính xác.'}</p></div>
          <Field
            label="Phương thức thanh toán"
            required
            error={errors.paymentMethodId?.message}
            {...aiFieldProps('paymentMethodId')}
          >
            <select className={`field ${aiFieldClass(aiFieldProps('paymentMethodId'))}`} required {...register('paymentMethodId')}>
              <option value="">Chọn phương thức</option>
              {paymentMethods.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Mục đích"
            required
            error={errors.purposeId?.message}
            {...aiFieldProps('purposeId')}
          >
            <select className={`field ${aiFieldClass(aiFieldProps('purposeId'))}`} required {...register('purposeId')}>
              <option value="">Chọn mục đích</option>
              {purposes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Danh mục"
            required
            error={errors.expenseTypeId?.message}
            {...aiFieldProps('expenseTypeId')}
          >
            <select className={`field ${aiFieldClass(aiFieldProps('expenseTypeId'))}`} required {...register('expenseTypeId')}>
              <option value="">Chọn loại chi phí</option>
              {expenseTypes.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </Field>
          <button type="button" className="btn-secondary flex items-center justify-between md:col-span-3" aria-expanded={extrasOpen} onClick={() => setExtrasOpen((value) => !value)}><span>Tùy chọn nâng cao</span><ChevronDown size={18} className={`transition-transform ${extrasOpen ? 'rotate-180' : ''}`}/></button>
          {extrasOpen && <div className="ui-enter grid gap-4 md:col-span-3 md:grid-cols-2">
            <Field label="Trạng thái" {...aiFieldProps('status')}>
              <select className={`field ${aiFieldClass(aiFieldProps('status'))}`} {...register('status')}>
                <option>Thực tế</option>
                <option>Dự kiến</option>
              </select>
              <span className="mt-1 block text-xs text-gray-500">Ứng dụng tự chọn theo ngày giao dịch. Chỉ thay đổi khi giao dịch chưa hoặc đã thực sự phát sinh khác với ngày.</span>
            </Field>
            <Field label="Ghi chú">
              <textarea className="field min-h-24" {...register('note')} />
            </Field>
          </div>}
          {draftRestored && <p role="status" className="md:col-span-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">Đã khôi phục bản nháp trên thiết bị. Hãy kiểm tra trước khi lưu.</p>}
          {saveError && <div role="alert" className="md:col-span-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"><p>{saveError}</p><button type="button" className="btn-secondary mt-2" disabled={saveBusy || deleteBusy || (isSupabaseConfigured && !online)} onClick={() => void handleSubmit(onSubmit)()}>Thử lại</button></div>}
          <div className="flex items-center gap-2 md:col-span-3">
            <button
              className="btn-primary h-12 min-w-0 flex-1 whitespace-nowrap px-3 md:flex-none md:px-4"
              type="submit"
              disabled={saveBusy || deleteBusy}
            >
              {saveBusy ? 'Đang lưu…' : id ? 'Lưu thay đổi' : 'Xác nhận và lưu'}
            </button>
            <button
              type="button"
              className="btn-secondary h-12 shrink-0 px-3 md:px-4"
              onClick={() => nav(-1)}
            >
              Hủy
            </button>
            {existing &&
              canDeleteTransaction(
                existing,
                currentUserRole,
                currentUserId,
              ) && (
                <button
                  type="button"
                  className="ml-auto inline-flex h-12 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-red-200 px-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30 md:px-4"
                  disabled={saveBusy || deleteBusy}
                  onClick={() => void deleteTransaction()}
                >
                  <Trash2 className="shrink-0" size={17} />
                  <span className="md:hidden">
                    {deleteBusy ? 'Đang xóa…' : 'Xóa'}
                  </span>
                  <span className="hidden md:inline">
                    {deleteBusy ? 'Đang xóa…' : 'Xóa giao dịch'}
                  </span>
                </button>
              )}
          </div>
      </form>
    </div>
  );
}
function Field({
  label,
  error,
  required = false,
  aiSuggested = false,
  aiTone = null,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  aiSuggested?: boolean;
  aiTone?: 'suggestion' | 'warning' | null;
  children: React.ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="label flex items-center gap-2">
        <span>{label}
          {required && (
            <>
              <span className="ml-1 text-red-600" aria-hidden="true">*</span>
              <span className="sr-only"> (bắt buộc)</span>
            </>
          )}
        </span>
        <AiBadge aiSuggested={aiSuggested} aiTone={aiTone} />
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      )}
    </label>
  );
}

type AiFieldVisualProps = {
  aiSuggested: boolean;
  aiTone: 'suggestion' | 'warning' | null;
};

function aiFieldClass({ aiSuggested, aiTone }: AiFieldVisualProps) {
  if (!aiSuggested) return '';
  return aiTone === 'warning'
    ? 'border-amber-400 bg-amber-50/70 ring-4 ring-amber-200/40 dark:border-amber-600 dark:bg-amber-950/20'
    : 'border-violet-400 bg-gradient-to-r from-violet-50/80 to-sky-50/70 ring-4 ring-violet-200/40 dark:border-violet-600 dark:from-violet-950/25 dark:to-sky-950/20';
}

function AiBadge({ aiSuggested, aiTone }: AiFieldVisualProps) {
  if (!aiSuggested) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${aiTone === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200'}`}>
      <Sparkles size={10} aria-hidden="true" /> AI đề xuất
    </span>
  );
}
