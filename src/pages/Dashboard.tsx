import {
  Cell,
  Bar,
  BarChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LabelList,
  Line,
  LineChart,
} from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, Scale } from 'lucide-react';
import { EmptyState, PageSkeleton } from '../components/AsyncStates';
import { useApp } from '../context/AppContext';
import { formatCompactVnd, formatVnd, getNetExpense } from '../lib/domain';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  fetchDashboardSummary,
  fetchDashboardTrends,
  fetchTransactionYears,
} from '../lib/transactionsApi';

const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const currentMonthKey = () => todayKey().slice(0, 7);
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1).padStart(2, '0'),
  label: `Tháng ${index + 1}`,
}));
const chartColors = ['#155e46', '#e6b85c', '#d97757', '#6081a8', '#7b6aa2'];

const recentMonths = (monthKey: string, count: number) => {
  const [year = 1970, month = 1] = monthKey.split('-').map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    const itemYear = date.getUTCFullYear();
    const itemMonth = date.getUTCMonth() + 1;
    return {
      key: `${itemYear}-${String(itemMonth).padStart(2, '0')}`,
      label: `T${itemMonth}`,
    };
  });
};
const adjacentMonth = (year: string, month: string, offset: number) => {
  const date = new Date(Date.UTC(Number(year), Number(month) - 1 + offset, 1));
  return { year: String(date.getUTCFullYear()), month: String(date.getUTCMonth() + 1).padStart(2, '0') };
};

export function Dashboard() {
  const navigate = useNavigate();
  const {
    familyId,
    transactions,
    purposes,
    expenseTypes,
    confirmPlannedTransaction,
  } = useApp();
  const queryClient = useQueryClient();
  const currentMonth = currentMonthKey();
  const [currentYear, currentMonthNumber] = currentMonth.split('-');
  const [selectedYear, setSelectedYear] = useState(currentYear || '');
  const [selectedMonth, setSelectedMonth] = useState(
    currentMonthNumber || '01',
  );
  const previousCurrentPeriod = adjacentMonth(currentYear || '', currentMonthNumber || '01', -1);
  const monthKey = `${selectedYear}-${selectedMonth}`;
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [dueError, setDueError] = useState('');
  const localAvailableYears = useMemo(() => Array.from(
    new Set([
      currentYear,
      ...transactions
        .map((transaction) => transaction.transactionDate.slice(0, 4))
        .filter((year) => /^\d{4}$/.test(year)),
    ]),
  ).sort((a, b) => Number(b) - Number(a)), [currentYear, transactions]);
  const actualTransactions = useMemo(() => transactions.filter(
    (transaction) => !transaction.deletedAt && transaction.status === 'Thực tế',
  ), [transactions]);
  const localDueTransactions = transactions
    .filter(
      (transaction) =>
        !transaction.deletedAt &&
        transaction.status === 'Dự kiến' &&
        transaction.transactionDate <= todayKey(),
    )
    .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  const localSelectedMonthTransactions = useMemo(() => actualTransactions.filter(
    (transaction) => transaction.transactionDate.startsWith(monthKey),
  ), [actualTransactions, monthKey]);
  const localTotalIncome = localSelectedMonthTransactions
    .filter(
      (transaction) =>
        transaction.transactionType === 'Thu nhập' ||
        transaction.transactionType === 'Hoàn tiền',
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const localTotalExpense = localSelectedMonthTransactions
    .filter(
      (transaction) =>
        transaction.transactionType === 'Chi tiêu' ||
        transaction.transactionType === 'Tạm ứng',
    )
    .reduce((total, transaction) => total + transaction.amount, 0);
  const localByPurpose = useMemo(() => purposes
    .map((purpose, index) => ({
      id: purpose.id,
      name: purpose.name,
      value: localSelectedMonthTransactions
        .filter((transaction) => transaction.purposeId === purpose.id)
        .reduce(
          (total, transaction) =>
            total +
            getNetExpense(transaction.amount, transaction.transactionType),
          0,
        ),
      fill: chartColors[index % chartColors.length] || '#155e46',
    }))
    .filter((item) => item.value > 0), [purposes, localSelectedMonthTransactions]);
  const localByExpenseType = useMemo(() => expenseTypes
    .map((expenseType, index) => ({
      id: expenseType.id,
      name: expenseType.name,
      value: localSelectedMonthTransactions
        .filter((transaction) => transaction.expenseTypeId === expenseType.id)
        .reduce(
          (total, transaction) =>
            total +
            getNetExpense(transaction.amount, transaction.transactionType),
          0,
        ),
      fill: chartColors[index % chartColors.length] || '#155e46',
    }))
    .filter((item) => item.value > 0), [expenseTypes, localSelectedMonthTransactions]);
  const localTrend = recentMonths(monthKey, 6).map((item) => ({
    m: item.label,
    v: actualTransactions
      .filter((transaction) => transaction.transactionDate.startsWith(item.key))
      .reduce(
        (total, transaction) =>
          total -
          getNetExpense(transaction.amount, transaction.transactionType),
        0,
      ),
  }));
  const summaryQuery = useQuery({
    queryKey: ['dashboard', familyId, selectedYear, selectedMonth],
    queryFn: () =>
      fetchDashboardSummary(
        familyId,
        Number(selectedYear),
        Number(selectedMonth),
      ),
    enabled: isSupabaseConfigured && Boolean(familyId),
  });
  const trendsQuery = useQuery({
    queryKey: ['dashboard-trends', familyId, selectedYear, selectedMonth],
    queryFn: () => fetchDashboardTrends(familyId, Number(selectedYear), Number(selectedMonth)),
    enabled: isSupabaseConfigured && Boolean(familyId),
  });
  const yearsQuery = useQuery({
    queryKey: ['transaction-years', familyId],
    queryFn: () => fetchTransactionYears(familyId),
    enabled: isSupabaseConfigured && Boolean(familyId),
    staleTime: 5 * 60_000,
  });
  const availableYears = isSupabaseConfigured
    ? Array.from(new Set([currentYear, ...(yearsQuery.data || [])])).sort(
        (a, b) => Number(b) - Number(a),
      )
    : localAvailableYears;
  const totalIncome = isSupabaseConfigured
    ? summaryQuery.data?.totalIncome || 0
    : localTotalIncome;
  const totalExpense = isSupabaseConfigured
    ? summaryQuery.data?.totalExpense || 0
    : localTotalExpense;
  const byPurpose = isSupabaseConfigured
    ? (summaryQuery.data?.byPurpose || []).map((item, index) => ({
        ...item,
        id: purposes.find((purpose) => purpose.name === item.name)?.id || '',
        fill: chartColors[index % chartColors.length] || '#155e46',
      }))
    : localByPurpose;
  const byExpenseType = isSupabaseConfigured
    ? (summaryQuery.data?.byExpenseType || []).map((item, index) => ({
        ...item,
        id: expenseTypes.find((expenseType) => expenseType.name === item.name)?.id || '',
        fill: chartColors[index % chartColors.length] || '#155e46',
      }))
    : localByExpenseType;
  const localIncomeTransactions = localSelectedMonthTransactions.filter((transaction) => transaction.transactionType === 'Thu nhập' || transaction.transactionType === 'Hoàn tiền');
  const incomeByPurpose = (isSupabaseConfigured ? summaryQuery.data?.incomeByPurpose || [] : purposes.map((item) => ({ id: item.id, name: item.name, value: localIncomeTransactions.filter((transaction) => transaction.purposeId === item.id).reduce((total, transaction) => total + transaction.amount, 0) })).filter((item) => item.value > 0)).map((item, index) => ({ ...item, id: String(('id' in item ? item.id : purposes.find((purpose) => purpose.name === item.name)?.id) || ''), fill: chartColors[index % chartColors.length] || '#155e46' }));
  const incomeByExpenseType = (isSupabaseConfigured ? summaryQuery.data?.incomeByExpenseType || [] : expenseTypes.map((item) => ({ id: item.id, name: item.name, value: localIncomeTransactions.filter((transaction) => transaction.expenseTypeId === item.id).reduce((total, transaction) => total + transaction.amount, 0) })).filter((item) => item.value > 0)).map((item, index) => ({ ...item, id: String(('id' in item ? item.id : expenseTypes.find((expenseType) => expenseType.name === item.name)?.id) || ''), fill: chartColors[index % chartColors.length] || '#155e46' }));
  const trend = isSupabaseConfigured
    ? summaryQuery.data?.trend || []
    : localTrend;
  const trendMonths = recentMonths(monthKey, 6);
  const localIncomeTrend = trendMonths.map((item) => ({
    m: item.label,
    v: actualTransactions.filter((transaction) => transaction.transactionDate.startsWith(item.key) && (transaction.transactionType === 'Thu nhập' || transaction.transactionType === 'Hoàn tiền')).reduce((total, transaction) => total + transaction.amount, 0),
  }));
  const localExpenseTrend = trendMonths.map((item) => ({
    m: item.label,
    v: actualTransactions.filter((transaction) => transaction.transactionDate.startsWith(item.key) && (transaction.transactionType === 'Chi tiêu' || transaction.transactionType === 'Tạm ứng')).reduce((total, transaction) => total + transaction.amount, 0),
  }));
  const incomeTrend = isSupabaseConfigured ? trendsQuery.data?.income || [] : localIncomeTrend;
  const expenseTrend = isSupabaseConfigured ? trendsQuery.data?.expense || [] : localExpenseTrend;
  const dueTransactions = isSupabaseConfigured
    ? summaryQuery.data?.dueTransactions || []
    : localDueTransactions;
  const confirmDueTransaction = async (id: string, description: string) => {
    if (
      !window.confirm(
        `Xác nhận giao dịch “${description}” đã phát sinh thực tế?`,
      )
    )
      return;
    setConfirmingId(id);
    setDueError('');
    const result = await confirmPlannedTransaction(id);
    setConfirmingId(null);
    if (result) setDueError(result);
    else if (isSupabaseConfigured)
      await queryClient.invalidateQueries({
        queryKey: ['dashboard', familyId],
      });
  };

  if (isSupabaseConfigured && summaryQuery.isPending)
    return <PageSkeleton label="Đang tải tổng quan tài chính…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500">
            Tháng {selectedMonth}/{selectedYear}
          </p>
          <h2 className="text-2xl font-extrabold">Tổng quan tài chính</h2>
        </div>
        <div className="grid w-full grid-cols-[minmax(0,1fr)_92px_84px] items-end gap-2 sm:flex sm:w-auto">
          <div className="flex h-[46px] min-w-0 rounded-xl bg-black/5 p-1 dark:bg-white/5">
            <button type="button" aria-label="Tháng trước" className={`min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold sm:px-3 ${selectedYear === previousCurrentPeriod.year && selectedMonth === previousCurrentPeriod.month ? 'bg-white shadow-sm dark:bg-white/10' : 'hover:bg-white dark:hover:bg-white/10'}`} onClick={() => { setSelectedYear(previousCurrentPeriod.year); setSelectedMonth(previousCurrentPeriod.month); }}><span className="sm:hidden">Trước</span><span className="hidden sm:inline">Tháng trước</span></button>
            <button type="button" aria-label="Tháng này" className={`min-w-0 flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-sm font-semibold sm:px-3 ${selectedYear === currentYear && selectedMonth === currentMonthNumber ? 'bg-white shadow-sm dark:bg-white/10' : 'hover:bg-white dark:hover:bg-white/10'}`} onClick={() => { setSelectedMonth(currentMonthNumber || '01'); setSelectedYear(currentYear || ''); }}><span className="sm:hidden">Nay</span><span className="hidden sm:inline">Tháng này</span></button>
          </div>
          <div>
            <label className="label" htmlFor="dashboard-month">
              Tháng
            </label>
            <select
              id="dashboard-month"
              className="field min-w-0 bg-white px-2 dark:bg-[#17251f] sm:min-w-32"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              {monthOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="dashboard-year">
              Năm
            </label>
            <select
              id="dashboard-year"
              className="field min-w-0 bg-white px-2 dark:bg-[#17251f] sm:min-w-28"
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {summaryQuery.isError && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          Không thể tải dữ liệu Dashboard. Vui lòng thử lại.
        </p>
      )}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Tổng thu" value={totalIncome} icon={ArrowDownToLine} tone="emerald" to={`/giao-dich?transactionType=Thu nhập&month=${selectedMonth}&year=${selectedYear}`} />
        <Kpi label="Tổng chi" value={totalExpense} icon={ArrowUpFromLine} tone="rose" to={`/giao-dich?transactionType=Chi tiêu&month=${selectedMonth}&year=${selectedYear}`} />
        <Kpi
          label="Giá trị ròng"
          value={totalIncome - totalExpense}
          icon={Scale}
          tone={totalIncome > totalExpense ? 'emerald' : totalIncome < totalExpense ? 'rose' : 'sky'}
          to={`/giao-dich?month=${selectedMonth}&year=${selectedYear}`}
        />
      </section>
      {dueTransactions.length > 0 && (
        <section className="card border-amber-300 p-4 dark:border-amber-700">
          <div className="mb-3">
            <h3 className="font-bold">Giao dịch dự kiến đến hạn</h3>
            <p className="text-sm text-gray-500">
              {dueTransactions.length} giao dịch cần xác nhận trước khi tính vào
              báo cáo thực tế.
            </p>
          </div>
          {dueError && (
            <p
              role="alert"
              className="mb-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300"
            >
              {dueError}
            </p>
          )}
          <div className="divide-y">
            {dueTransactions.map((transaction) => (
              <div
                key={transaction.id}
                className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {transaction.description}
                  </p>
                  <p className="text-xs text-gray-500">
                    Đến hạn{' '}
                    {new Date(
                      `${transaction.transactionDate}T00:00:00`,
                    ).toLocaleDateString('vi-VN')}{' '}
                    · {formatVnd(transaction.amount)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={confirmingId === transaction.id}
                  onClick={() =>
                    void confirmDueTransaction(
                      transaction.id,
                      transaction.description,
                    )
                  }
                >
                  {confirmingId === transaction.id
                    ? 'Đang xác nhận…'
                    : 'Xác nhận thực tế'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card min-w-0 overflow-hidden p-4">
          <ExpensePieChart
            title="Chi tiêu theo mục đích"
            data={byPurpose}
            to={`/giao-dich?month=${selectedMonth}&year=${selectedYear}`}
          />
        </div>
        <div className="card min-w-0 overflow-hidden p-4">
          <ExpensePieChart title="Thu nhập theo mục đích" data={incomeByPurpose} to={`/giao-dich?transactionType=Thu nhập&month=${selectedMonth}&year=${selectedYear}`} filterKey="purposeId" />
        </div>
        <div className="card min-w-0 overflow-hidden p-4">
          <ExpenseBarChart title="Thu nhập theo danh mục" data={incomeByExpenseType} to={`/giao-dich?transactionType=Thu nhập&month=${selectedMonth}&year=${selectedYear}`} filterKey="expenseTypeId" />
        </div>
        <div className="card min-w-0 overflow-hidden p-4">
          <ExpenseBarChart
            title="Chi tiêu theo danh mục"
            data={byExpenseType}
            to={`/giao-dich?month=${selectedMonth}&year=${selectedYear}`}
          />
        </div>
        <div className="card min-w-0 overflow-hidden p-4">
          <h3 className="font-bold">Thu nhập 6 tháng gần nhất</h3>
          <div className="h-64 min-w-0 max-w-full">
            <ResponsiveContainer>
              <BarChart data={incomeTrend} margin={{ top: 24, right: 18, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="m" /><YAxis tickFormatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} width={48} /><Tooltip formatter={(value) => formatVnd(Number(value))} /><Bar name="Thu nhập" dataKey="v" fill="#155e46" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(_, index) => { const period = trendMonths[index]; if (period) navigate(`/giao-dich?transactionType=Thu nhập&month=${period.key.slice(5, 7)}&year=${period.key.slice(0, 4)}`); }}><LabelList dataKey="v" position="top" formatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card min-w-0 overflow-hidden p-4">
          <h3 className="font-bold">Chi tiêu 6 tháng gần nhất</h3>
          <div className="h-64 min-w-0 max-w-full">
            <ResponsiveContainer>
              <BarChart data={expenseTrend} margin={{ top: 24, right: 18, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="m" /><YAxis tickFormatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} width={48} /><Tooltip formatter={(value) => formatVnd(Number(value))} /><Bar name="Chi tiêu" dataKey="v" fill="#d96f4f" radius={[8, 8, 0, 0]} cursor="pointer" onClick={(_, index) => { const period = trendMonths[index]; if (period) navigate(`/giao-dich?transactionType=Chi tiêu&month=${period.key.slice(5, 7)}&year=${period.key.slice(0, 4)}`); }}><LabelList dataKey="v" position="top" formatter={(value) => formatCompactVnd(Number(value)).replace(' ₫', '')} /></Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card min-w-0 overflow-hidden p-4 lg:col-span-2">
          <h3 className="font-bold">Chi ròng thực tế</h3>
          <div className="h-64 min-w-0 max-w-full">
            <ResponsiveContainer>
              <LineChart data={trend} margin={{ top: 24, right: 18, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="m" />
                <YAxis
                  tickFormatter={(value) =>
                    formatCompactVnd(Number(value)).replace(' ₫', '')
                  }
                  width={48}
                />
                <Tooltip formatter={(value) => formatVnd(Number(value))} />
                <Legend verticalAlign="bottom" />
                <Line
                  name="Chi ròng thực tế"
                  type="monotone"
                  dataKey="v"
                  stroke="#155e46"
                  strokeWidth={3}
                >
                  <LabelList
                    dataKey="v"
                    position="top"
                    formatter={(value) =>
                      formatCompactVnd(Number(value)).replace(' ₫', '')
                    }
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

type ExpenseChartItem = { id: string; name: string; value: number; fill: string };

function ExpensePieChart({
  title,
  data,
  to,
  filterKey = 'purposeId',
}: {
  title: string;
  data: ExpenseChartItem[];
  to: string;
  filterKey?: 'purposeId' | 'expenseTypeId';
}) {
  const navigate = useNavigate();
  const openItem = (item: ExpenseChartItem) => {
    if (item.id) navigate(`${to}&${filterKey}=${encodeURIComponent(item.id)}`);
  };
  return (
    <>
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{title}</h3><Link className="text-xs font-semibold text-[#137050] dark:text-emerald-300" to={to}>Xem giao dịch</Link></div>
      <div className="h-72 min-w-0 max-w-full overflow-hidden pt-3">
        {data.length ? (
          <ResponsiveContainer>
            <PieChart margin={{ top: 18, right: 18, left: 18, bottom: 0 }}>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                labelLine
                label={({ value }) =>
                  formatCompactVnd(Number(value)).replace(' ₫', '')
                }
              >
                {data.map((item) => (
                  <Cell key={item.name} fill={item.fill} cursor={item.id ? 'pointer' : undefined} onClick={() => openItem(item)} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatVnd(Number(value))} />
              <Legend verticalAlign="bottom" iconType="circle" />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="Chưa có dữ liệu biểu đồ" description="Biểu đồ sẽ xuất hiện khi tháng này có giao dịch chi tiêu thực tế."/>
        )}
      </div>
    </>
  );
}

function ExpenseBarChart({
  title,
  data,
  to,
  filterKey = 'expenseTypeId',
}: {
  title: string;
  data: ExpenseChartItem[];
  to: string;
  filterKey?: 'purposeId' | 'expenseTypeId';
}) {
  const navigate = useNavigate();
  const openItem = (item: ExpenseChartItem) => {
    if (item.id) navigate(`${to}&${filterKey}=${encodeURIComponent(item.id)}`);
  };
  const chartWidth = Math.max(520, data.length * 78);
  return (
    <>
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold">{title}</h3><Link className="text-xs font-semibold text-[#137050] dark:text-emerald-300" to={to}>Xem giao dịch</Link></div>
      <div className="h-72 w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain">
        {data.length ? (
          <div className="h-full" style={{ minWidth: chartWidth }}>
            <ResponsiveContainer>
              <BarChart
                data={data}
                margin={{ top: 28, right: 12, bottom: 12, left: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-25}
                  textAnchor="end"
                  height={68}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(value) =>
                    formatCompactVnd(Number(value)).replace(' ₫', '')
                  }
                  width={48}
                />
                <Tooltip formatter={(value) => formatVnd(Number(value))} />
                <Bar dataKey="value" name="Tiền ra" radius={[6, 6, 0, 0]}>
                  {data.map((item) => (
                  <Cell key={item.name} fill={item.fill} cursor={item.id ? 'pointer' : undefined} onClick={() => openItem(item)} />
                  ))}
                  <LabelList
                    dataKey="value"
                    position="top"
                    formatter={(value) =>
                      formatCompactVnd(Number(value)).replace(' ₫', '')
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="Chưa có dữ liệu biểu đồ" description="Biểu đồ sẽ xuất hiện khi tháng này có giao dịch chi tiêu thực tế."/>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, icon: Icon, tone, to }: { label: string; value: number; icon: typeof Scale; tone: 'emerald' | 'rose' | 'sky'; to: string }) {
  const toneClass = tone === 'emerald' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : tone === 'rose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300';
  return (
    <Link to={to} className="card flex min-w-0 items-start gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#137050]" aria-label={`Mở giao dịch theo ${label}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass}`}><Icon size={19} aria-hidden="true"/></span><div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{label}</p>
      <p
        className="mt-2 truncate text-lg font-extrabold md:text-2xl"
        title={formatVnd(value)}
        aria-label={`${label}: ${formatVnd(value)}`}
      >
        {formatVnd(value)}
      </p>
      </div>
    </Link>
  );
}
