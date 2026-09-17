import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent, User } from '@supabase/supabase-js';
import type { CatalogItem, CatalogItemRow, Transaction } from '../lib/domain';
import {
  expenseTypeNameEn,
  expenseTypeNames,
  mapCatalogItem,
  makeItems,
  normalizeText,
  paymentMethodNameEn,
  paymentMethodNames,
  purposeNameEn,
  purposeNames,
} from '../lib/domain';
import {
  getDefaultCatalogIcon,
  normalizeCatalogIconKey,
} from '../lib/catalogIcons';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { userFacingError } from '../lib/errorRecovery';

type AppState = {
  familyId: string;
  familyName: string;
  currentUserEmail: string;
  currentUserDisplayName: string;
  currentUserId: string;
  currentUserRole: 'owner' | 'member' | null;
  purposes: CatalogItem[];
  expenseTypes: CatalogItem[];
  paymentMethods: CatalogItem[];
  transactions: Transaction[];
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
  online: boolean;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  reloadApp: () => void;
  addCatalogItem: (
    kind: CatalogKind,
    name: string,
    nameEn?: string,
    icon?: string,
    budgetEnabled?: boolean,
  ) => Promise<string | null>;
  updateCatalogItem: (
    kind: CatalogKind,
    id: string,
    name: string,
    nameEn?: string,
    icon?: string,
    budgetEnabled?: boolean,
  ) => Promise<string | null>;
  deleteCatalogItem: (kind: CatalogKind, id: string) => Promise<string | null>;
  confirmPlannedTransaction: (id: string) => Promise<string | null>;
  updateFamilyName: (name: string) => Promise<string | null>;
  createFamily: (name: string) => Promise<string | null>;
  deleteFamily: () => Promise<string | null>;
};

export type CatalogKind = 'purpose' | 'expenseType' | 'paymentMethod';
const AppContext = createContext<AppState | null>(null);
const withDefaultIcons = (items: CatalogItem[]) =>
  items.map((item) => ({ ...item, icon: getDefaultCatalogIcon(item.name) }));
const fallbackPurposes = withDefaultIcons(makeItems(purposeNames, purposeNameEn));
const fallbackExpenseTypes = withDefaultIcons(makeItems(expenseTypeNames, expenseTypeNameEn));
const fallbackPaymentMethods = withDefaultIcons(makeItems(paymentMethodNames, paymentMethodNameEn));
const localFamilyId = 'local-family';
const localDemoEmail = 'demo@family.local';
const localDemoDisplayName = 'Chủ gia đình';

const getAuthDisplayName = (user: User) => {
  const metadataName = [user.user_metadata?.full_name, user.user_metadata?.name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0)
    ?.trim();
  return metadataName || user.email || 'Tài khoản đã đăng nhập';
};

export function shouldReloadAppForAuthEvent(event: AuthChangeEvent) {
  return event !== 'TOKEN_REFRESHED';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [familyId, setFamilyId] = useState(
    isSupabaseConfigured ? '' : localFamilyId,
  );
  const [familyName, setFamilyName] = useState('Gia đình của tôi');
  const [currentUserEmail, setCurrentUserEmail] = useState(
    isSupabaseConfigured ? '' : localDemoEmail,
  );
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState(
    isSupabaseConfigured ? '' : localDemoDisplayName,
  );
  const [currentUserId, setCurrentUserId] = useState(
    isSupabaseConfigured ? '' : 'local-user',
  );
  const [currentUserRole, setCurrentUserRole] = useState<
    'owner' | 'member' | null
  >(isSupabaseConfigured ? null : 'owner');
  const [purposes, setPurposes] = useState<CatalogItem[]>(
    isSupabaseConfigured ? [] : fallbackPurposes,
  );
  const [expenseTypes, setExpenseTypes] = useState<CatalogItem[]>(
    isSupabaseConfigured ? [] : fallbackExpenseTypes,
  );
  const [paymentMethods, setPaymentMethods] = useState<CatalogItem[]>(
    isSupabaseConfigured ? [] : fallbackPaymentMethods,
  );
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authenticated, setAuthenticated] = useState(!isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [reloadNonce, setReloadNonce] = useState(0);
  const reloadApp = useCallback(() => setReloadNonce((value) => value + 1), []);

  useEffect(() => {
    const updateOnline = () => {
      const nextOnline = navigator.onLine;
      setOnline(nextOnline);
      if (nextOnline) setReloadNonce((value) => value + 1);
    };
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const load = async (showInitialLoading = false) => {
      try {
        if (showInitialLoading) setLoading(true);
        setError(null);
        const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (active) {
          setAuthenticated(false);
          setCurrentUserEmail('');
          setCurrentUserDisplayName('');
          setCurrentUserId('');
          setCurrentUserRole(null);
          setFamilyId('');
          setFamilyName('Gia đình của tôi');
          setPurposes([]);
          setExpenseTypes([]);
          setPaymentMethods([]);
          setTransactions([]);
          setLoading(false);
          setError(null);
        }
        return;
      }
      const authDisplayName = getAuthDisplayName(user);
      if (active) {
        setAuthenticated(true);
        setCurrentUserEmail(user.email || 'Tài khoản đã đăng nhập');
        setCurrentUserDisplayName(authDisplayName);
        setCurrentUserId(user.id);
      }
      if (!navigator.onLine) {
        setLoading(false);
        setError('Không có kết nối mạng. Hãy kết nối Internet rồi thử lại.');
        return;
      }
      const { data: membership, error: membershipError } = await supabase
        .from('family_members')
        .select('family_id, role, display_name, families(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        if (active) {
          setLoading(false);
          setFamilyId('');
          setFamilyName('Gia đình của tôi');
          setCurrentUserRole(null);
          setPurposes([]);
          setExpenseTypes([]);
          setPaymentMethods([]);
          setTransactions([]);
          setError(
            membershipError
              ? userFacingError(membershipError, 'Không thể tải gia đình hiện tại.')
              : null,
          );
        }
        return;
      }
      const id = membership.family_id as string;
      const [purposeResult, typeResult, methodResult] = await Promise.all([
        supabase
          .from('purposes')
          .select('id,name,name_en,color,icon,active,budget_enabled')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('expense_types')
          .select('id,name,name_en,icon,active')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('payment_methods')
          .select('id,name,name_en,icon,active')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
      ]);
      const firstError =
        purposeResult.error || typeResult.error || methodResult.error;
      if (firstError) {
        if (active) {
          setLoading(false);
          setFamilyId('');
          setFamilyName('Gia đình của tôi');
          setPurposes([]);
          setExpenseTypes([]);
          setPaymentMethods([]);
          setTransactions([]);
          setError(userFacingError(firstError, 'Không thể tải danh mục gia đình.'));
        }
        return;
      }
      if (!active) return;
      const familyRelation = membership.families as unknown as {
        name?: string;
      } | null;
      setFamilyId(id);
      setFamilyName(familyRelation?.name || 'Gia đình của tôi');
      const memberDisplayName =
        typeof membership.display_name === 'string'
          ? membership.display_name.trim()
          : '';
      setCurrentUserDisplayName(memberDisplayName || authDisplayName);
      setCurrentUserRole(membership.role as 'owner' | 'member');
      setPurposes((purposeResult.data || []).map((item) => mapCatalogItem(item)));
      setExpenseTypes((typeResult.data || []).map((item) => mapCatalogItem(item)));
      setPaymentMethods((methodResult.data || []).map((item) => mapCatalogItem(item)));
      setLoading(false);
      } catch (loadError) {
        if (!active) return;
        setLoading(false);
        setFamilyId('');
        setFamilyName('Gia đình của tôi');
        setPurposes([]);
        setExpenseTypes([]);
        setPaymentMethods([]);
        setTransactions([]);
        setError(userFacingError(loadError, 'Không thể tải dữ liệu gia đình.'));
      }
    };
    void load(true);
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      // Supabase refreshes the session when the browser regains focus after a
      // native file picker closes. Reloading here would unmount the current
      // route and discard the selected Excel file before parsing can finish.
      if (shouldReloadAppForAuthEvent(event)) void load(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [reloadNonce]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const refreshOnReturn = () => {
      if (document.visibilityState === 'visible') void supabase.auth.refreshSession();
    };
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  }, []);

  const addCatalogItem = useCallback(
    async (kind: CatalogKind, rawName: string, rawNameEn = '', rawIcon = '', budgetEnabled = true) => {
      const name = rawName.trim().replace(/\s+/g, ' ');
      const nameEn = rawNameEn.trim().replace(/\s+/g, ' ');
      const icon = normalizeCatalogIconKey(rawIcon);
      if (!familyId) return 'Không tìm thấy gia đình hiện tại.';
      if (!name) return 'Vui lòng nhập tên danh mục.';
      const currentItems =
        kind === 'purpose'
          ? purposes
          : kind === 'expenseType'
            ? expenseTypes
            : paymentMethods;
      if (
        currentItems.some(
          (item) => normalizeText(item.name) === normalizeText(name),
        )
      )
        return 'Tên danh mục đã tồn tại.';
      if (nameEn && currentItems.some((item) => normalizeText(item.nameEn || '') === normalizeText(nameEn)))
        return 'Tên tiếng Anh của danh mục đã tồn tại.';

      const sortOrder = currentItems.length ? currentItems.length + 1 : 1;
      const code = `${normalizeText(name).replace(/\s+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      if (!isSupabaseConfigured) {
        const item: CatalogItem = {
          id: `local-${kind}-${crypto.randomUUID()}`,
          name,
          nameEn: nameEn || undefined,
          icon: icon || getDefaultCatalogIcon(name),
          active: true,
          ...(kind === 'purpose' ? { budgetEnabled } : {}),
        };
        if (kind === 'purpose') setPurposes((items) => [...items, item]);
        else if (kind === 'expenseType') setExpenseTypes((items) => [...items, item]);
        else setPaymentMethods((items) => [...items, item]);
        return null;
      }
      let data: CatalogItemRow | null = null;
      let insertError: { code?: string; message: string } | null = null;
      if (kind === 'purpose') {
        const result = await supabase
          .from('purposes')
          .insert({
            family_id: familyId,
            name,
            name_en: nameEn || null,
            code,
            color: '#6081a8',
            icon,
            sort_order: sortOrder,
            active: true,
            budget_enabled: budgetEnabled,
          })
          .select('id,name,name_en,color,icon,active,budget_enabled')
          .single();
        data = result.data as CatalogItemRow | null;
        insertError = result.error;
      } else if (kind === 'expenseType') {
        const result = await supabase
          .from('expense_types')
          .insert({
            family_id: familyId,
            name,
            name_en: nameEn || null,
            code,
            icon,
            sort_order: sortOrder,
            active: true,
          })
          .select('id,name,name_en,icon,active')
          .single();
        data = result.data as CatalogItemRow | null;
        insertError = result.error;
      } else {
        const result = await supabase
          .from('payment_methods')
          .insert({
            family_id: familyId,
            name,
            name_en: nameEn || null,
            icon,
            sort_order: sortOrder,
            active: true,
          })
          .select('id,name,name_en,icon,active')
          .single();
        data = result.data as CatalogItemRow | null;
        insertError = result.error;
      }
      if (insertError)
        return insertError.code === '42501'
          ? 'Chỉ owner mới có quyền thêm danh mục.'
          : userFacingError(insertError, 'Không thể thêm danh mục.');
      if (!data) return 'Không thể tạo danh mục.';
      const item = mapCatalogItem(data);
      if (kind === 'purpose') setPurposes((items) => [...items, item]);
      else if (kind === 'expenseType')
        setExpenseTypes((items) => [...items, item]);
      else setPaymentMethods((items) => [...items, item]);
      return null;
    },
    [familyId, purposes, expenseTypes, paymentMethods],
  );

  const updateCatalogItem = useCallback(
    async (kind: CatalogKind, id: string, rawName: string, rawNameEn = '', rawIcon = '', budgetEnabled?: boolean) => {
      const name = rawName.trim().replace(/\s+/g, ' ');
      const nameEn = rawNameEn.trim().replace(/\s+/g, ' ');
      const icon = normalizeCatalogIconKey(rawIcon);
      if (!familyId) return 'Không tìm thấy gia đình hiện tại.';
      if (!name) return 'Vui lòng nhập tên danh mục.';
      const currentItems =
        kind === 'purpose'
          ? purposes
          : kind === 'expenseType'
            ? expenseTypes
            : paymentMethods;
      if (
        currentItems.some(
          (item) =>
            item.id !== id && normalizeText(item.name) === normalizeText(name),
        )
      )
        return 'Tên danh mục đã tồn tại.';
      if (nameEn && currentItems.some((item) => item.id !== id && normalizeText(item.nameEn || '') === normalizeText(nameEn)))
        return 'Tên tiếng Anh của danh mục đã tồn tại.';
      const existingItem = currentItems.find((item) => item.id === id);
      const nextBudgetEnabled = budgetEnabled ?? existingItem?.budgetEnabled ?? true;
      const table =
        kind === 'purpose'
          ? 'purposes'
          : kind === 'expenseType'
            ? 'expense_types'
            : 'payment_methods';
      if (!isSupabaseConfigured) {
        const replace = (items: CatalogItem[]) =>
          items.map((item) =>
            item.id === id
              ? {
                  ...item,
                  name,
                  nameEn: nameEn || undefined,
                  icon: icon || getDefaultCatalogIcon(name),
                  ...(kind === 'purpose' ? { budgetEnabled: nextBudgetEnabled } : {}),
                }
              : item,
          );
        if (kind === 'purpose') setPurposes(replace);
        else if (kind === 'expenseType') setExpenseTypes(replace);
        else setPaymentMethods(replace);
        return null;
      }
      if (kind === 'purpose') {
        const result = await supabase
          .from(table)
          .update({ name, name_en: nameEn || null, icon, budget_enabled: nextBudgetEnabled })
          .eq('id', id)
          .eq('family_id', familyId)
          .select('id,name,name_en,color,icon,active,budget_enabled')
          .single();
        if (result.error)
          return result.error.code === '42501'
            ? 'Chỉ owner mới có quyền sửa danh mục.'
            : userFacingError(result.error, 'Không thể sửa danh mục.');
        const replace = (items: CatalogItem[]) =>
          items.map((item) => (item.id === id ? { ...item, name, nameEn: nameEn || undefined, icon, budgetEnabled: nextBudgetEnabled } : item));
        setPurposes(replace);
        return null;
      }
      const result = await supabase
        .from(table)
        .update({ name, name_en: nameEn || null, icon })
        .eq('id', id)
        .eq('family_id', familyId)
        .select('id,name,name_en,icon,active')
        .single();
      if (result.error)
        return result.error.code === '42501'
          ? 'Chỉ owner mới có quyền sửa danh mục.'
          : userFacingError(result.error, 'Không thể sửa danh mục.');
      const replace = (items: CatalogItem[]) =>
        items.map((item) => (item.id === id ? { ...item, name, nameEn: nameEn || undefined, icon } : item));
      if (kind === 'expenseType') setExpenseTypes(replace);
      else setPaymentMethods(replace);
      return null;
    },
    [familyId, purposes, expenseTypes, paymentMethods],
  );

  const deleteCatalogItem = useCallback(
    async (kind: CatalogKind, id: string) => {
      if (!familyId) return 'Không tìm thấy gia đình hiện tại.';
      if (!isSupabaseConfigured) {
        const inUse = transactions.some(
          (transaction) =>
            !transaction.deletedAt &&
            (kind === 'purpose'
              ? transaction.purposeId === id
              : kind === 'expenseType'
                ? transaction.expenseTypeId === id
                : transaction.paymentMethodId === id),
        );
        if (inUse)
          return 'Không thể xóa vì danh mục đã được sử dụng trong bảng giao dịch.';
        const remove = (items: CatalogItem[]) => items.filter((item) => item.id !== id);
        if (kind === 'purpose') setPurposes(remove);
        else if (kind === 'expenseType') setExpenseTypes(remove);
        else setPaymentMethods(remove);
        return null;
      }
      const { data, error: rpcError } = await supabase.rpc(
        'delete_catalog_item',
        { p_family_id: familyId, p_kind: kind, p_item_id: id },
      );
      if (rpcError) {
        if (rpcError.message.includes('CATALOG_IN_USE'))
          return 'Không thể xóa vì danh mục đã được sử dụng trong bảng giao dịch.';
        if (rpcError.message.includes('FORBIDDEN') || rpcError.code === '42501')
          return 'Chỉ owner mới có quyền xóa danh mục.';
        return userFacingError(rpcError, 'Không thể xóa danh mục.');
      }
      if (data !== true) return 'Không tìm thấy danh mục cần xóa.';
      const remove = (items: CatalogItem[]) =>
        items.filter((item) => item.id !== id);
      if (kind === 'purpose') setPurposes(remove);
      else if (kind === 'expenseType') setExpenseTypes(remove);
      else setPaymentMethods(remove);
      return null;
    },
    [familyId, transactions],
  );

  const confirmPlannedTransaction = useCallback(
    async (id: string) => {
      const markAsActual = () =>
        setTransactions((items) =>
          items.map((item) =>
            item.id === id ? { ...item, status: 'Thực tế' } : item,
          ),
        );
      if (!isSupabaseConfigured) {
        markAsActual();
        return null;
      }
      if (!familyId || !currentUserId)
        return 'Không tìm thấy gia đình hoặc tài khoản hiện tại.';
      const { data, error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'Thực tế', updated_by: currentUserId })
        .eq('id', id)
        .eq('family_id', familyId)
        .eq('status', 'Dự kiến')
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();
      if (updateError) return userFacingError(updateError, 'Không thể xác nhận giao dịch.');
      if (!data) return 'Giao dịch không còn ở trạng thái dự kiến.';
      markAsActual();
      return null;
    },
    [familyId, currentUserId],
  );

  const updateFamilyName = useCallback(
    async (rawName: string) => {
      const name = rawName.trim().replace(/\s+/g, ' ');
      if (!name) return 'Tên gia đình không được để trống.';
      if (name.length > 100)
        return 'Tên gia đình không được dài quá 100 ký tự.';
      if (!isSupabaseConfigured) {
        setFamilyName(name);
        return null;
      }
      const { data, error: rpcError } = await supabase.rpc(
        'update_family_name',
        { p_family_id: familyId, p_name: name },
      );
      if (rpcError)
        return rpcError.message.includes('FORBIDDEN')
          ? 'Chỉ chủ gia đình mới được đổi tên gia đình.'
          : userFacingError(rpcError, 'Không thể đổi tên gia đình.');
      setFamilyName(String(data));
      return null;
    },
    [familyId],
  );

  const createFamily = useCallback(async (rawName: string) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) return 'Vui lòng nhập tên gia đình.';
    if (name.length > 100) return 'Tên gia đình không được dài quá 100 ký tự.';
    if (!isSupabaseConfigured) {
      setFamilyId(localFamilyId);
      setFamilyName(name);
      setCurrentUserId('local-user');
      setCurrentUserEmail(localDemoEmail);
      setCurrentUserDisplayName(localDemoDisplayName);
      setCurrentUserRole('owner');
      setAuthenticated(true);
      setPurposes(fallbackPurposes);
      setExpenseTypes(fallbackExpenseTypes);
      setPaymentMethods(fallbackPaymentMethods);
      setError(null);
      return null;
    }
    const { error: rpcError } = await supabase.rpc(
      'create_family_with_defaults',
      { p_name: name },
    );
    if (!rpcError) return null;
    if (rpcError.message.includes('ALREADY_HAS_FAMILY'))
      return 'Tài khoản này đã thuộc một gia đình.';
    if (rpcError.message.includes('INVALID_NAME'))
      return 'Tên gia đình không hợp lệ.';
    return userFacingError(rpcError, 'Không thể tạo gia đình.');
  }, []);

  const deleteFamily = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setFamilyId('');
      setFamilyName('Gia đình của tôi');
      setCurrentUserRole(null);
      setPurposes([]);
      setExpenseTypes([]);
      setPaymentMethods([]);
      setTransactions([]);
      return null;
    }
    const { error: rpcError } = await supabase.rpc('delete_empty_family', {
      p_family_id: familyId,
    });
    if (rpcError) {
      if (
        rpcError.message.includes('FAMILY_HAS_ACTIVE_TRANSACTIONS') ||
        rpcError.message.includes('FAMILY_HAS_TRANSACTIONS')
      )
        return 'Hãy xóa hết giao dịch trước khi xóa gia đình.';
      if (rpcError.message.includes('FORBIDDEN'))
        return 'Chỉ chủ gia đình mới được xóa gia đình.';
      return userFacingError(rpcError, 'Không thể xóa gia đình.');
    }
    setFamilyId('');
    setFamilyName('Gia đình của tôi');
    setCurrentUserRole(null);
    setTransactions([]);
    return null;
  }, [familyId]);

  const value = useMemo(
    () => ({
      familyId,
      familyName,
      currentUserEmail,
      currentUserDisplayName,
      currentUserId,
      currentUserRole,
      purposes,
      expenseTypes,
      paymentMethods,
      transactions,
      setTransactions,
      online,
      reloadApp,
      loading,
      authenticated,
      error,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      confirmPlannedTransaction,
      updateFamilyName,
      createFamily,
      deleteFamily,
    }),
    [
      familyId,
      familyName,
      currentUserEmail,
      currentUserDisplayName,
      currentUserId,
      currentUserRole,
      purposes,
      expenseTypes,
      paymentMethods,
      transactions,
      online,
      reloadApp,
      loading,
      authenticated,
      error,
      addCatalogItem,
      updateCatalogItem,
      deleteCatalogItem,
      confirmPlannedTransaction,
      updateFamilyName,
      createFamily,
      deleteFamily,
    ],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider missing');
  return value;
};
