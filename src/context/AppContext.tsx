import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthChangeEvent } from '@supabase/supabase-js';
import type { CatalogItem, Transaction } from '../lib/domain';
import {
  expenseTypeNames,
  makeItems,
  normalizeText,
  paymentMethodNames,
  purposeNames,
} from '../lib/domain';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

type AppState = {
  familyId: string;
  familyName: string;
  currentUserEmail: string;
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
  addCatalogItem: (kind: CatalogKind, name: string) => Promise<string | null>;
  updateCatalogItem: (
    kind: CatalogKind,
    id: string,
    name: string,
  ) => Promise<string | null>;
  deleteCatalogItem: (kind: CatalogKind, id: string) => Promise<string | null>;
  confirmPlannedTransaction: (id: string) => Promise<string | null>;
  updateFamilyName: (name: string) => Promise<string | null>;
  createFamily: (name: string) => Promise<string | null>;
  deleteFamily: () => Promise<string | null>;
};

export type CatalogKind = 'purpose' | 'expenseType' | 'paymentMethod';
const AppContext = createContext<AppState | null>(null);
const fallbackPurposes = makeItems(purposeNames);
const fallbackExpenseTypes = makeItems(expenseTypeNames);
const fallbackPaymentMethods = makeItems(paymentMethodNames);

export function shouldReloadAppForAuthEvent(event: AuthChangeEvent) {
  return event !== 'TOKEN_REFRESHED';
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [familyId, setFamilyId] = useState('');
  const [familyName, setFamilyName] = useState('Gia đình của tôi');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
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

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let active = true;
    const load = async (showInitialLoading = false) => {
      if (showInitialLoading) setLoading(true);
      setError(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) {
        if (active) {
          setAuthenticated(false);
          setCurrentUserEmail('');
          setCurrentUserId('');
          setCurrentUserRole(null);
          setLoading(false);
          setError(null);
        }
        return;
      }
      if (active) {
        setAuthenticated(true);
        setCurrentUserEmail(user.email || 'Tài khoản đã đăng nhập');
        setCurrentUserId(user.id);
      }
      const { data: membership, error: membershipError } = await supabase
        .from('family_members')
        .select('family_id, role, families(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        if (active) {
          setLoading(false);
          setFamilyId('');
          setCurrentUserRole(null);
          setError(membershipError ? membershipError.message : null);
        }
        return;
      }
      const id = membership.family_id as string;
      const [purposeResult, typeResult, methodResult] = await Promise.all([
        supabase
          .from('purposes')
          .select('id,name,color,active')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('expense_types')
          .select('id,name,active')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
        supabase
          .from('payment_methods')
          .select('id,name,active')
          .eq('family_id', id)
          .eq('active', true)
          .order('sort_order'),
      ]);
      const firstError =
        purposeResult.error || typeResult.error || methodResult.error;
      if (firstError) {
        if (active) {
          setLoading(false);
          setError(firstError.message);
        }
        return;
      }
      if (!active) return;
      const familyRelation = membership.families as unknown as {
        name?: string;
      } | null;
      setFamilyId(id);
      setFamilyName(familyRelation?.name || 'Gia đình của tôi');
      setCurrentUserRole(membership.role as 'owner' | 'member');
      setPurposes((purposeResult.data || []) as CatalogItem[]);
      setExpenseTypes((typeResult.data || []) as CatalogItem[]);
      setPaymentMethods((methodResult.data || []) as CatalogItem[]);
      setLoading(false);
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
  }, []);

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
    async (kind: CatalogKind, rawName: string) => {
      const name = rawName.trim().replace(/\s+/g, ' ');
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

      const sortOrder = currentItems.length ? currentItems.length + 1 : 1;
      const code = `${normalizeText(name).replace(/\s+/g, '-')}-${crypto.randomUUID().slice(0, 8)}`;
      let data: CatalogItem | null = null;
      let insertError: { code?: string; message: string } | null = null;
      if (kind === 'purpose') {
        const result = await supabase
          .from('purposes')
          .insert({
            family_id: familyId,
            name,
            code,
            color: '#6081a8',
            sort_order: sortOrder,
            active: true,
          })
          .select('id,name,active')
          .single();
        data = result.data as CatalogItem | null;
        insertError = result.error;
      } else if (kind === 'expenseType') {
        const result = await supabase
          .from('expense_types')
          .insert({
            family_id: familyId,
            name,
            code,
            sort_order: sortOrder,
            active: true,
          })
          .select('id,name,active')
          .single();
        data = result.data as CatalogItem | null;
        insertError = result.error;
      } else {
        const result = await supabase
          .from('payment_methods')
          .insert({
            family_id: familyId,
            name,
            sort_order: sortOrder,
            active: true,
          })
          .select('id,name,active')
          .single();
        data = result.data as CatalogItem | null;
        insertError = result.error;
      }
      if (insertError)
        return insertError.code === '42501'
          ? 'Chỉ owner mới có quyền thêm danh mục.'
          : insertError.message;
      if (!data) return 'Không thể tạo danh mục.';
      const item = data;
      if (kind === 'purpose') setPurposes((items) => [...items, item]);
      else if (kind === 'expenseType')
        setExpenseTypes((items) => [...items, item]);
      else setPaymentMethods((items) => [...items, item]);
      return null;
    },
    [familyId, purposes, expenseTypes, paymentMethods],
  );

  const updateCatalogItem = useCallback(
    async (kind: CatalogKind, id: string, rawName: string) => {
      const name = rawName.trim().replace(/\s+/g, ' ');
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
      const table =
        kind === 'purpose'
          ? 'purposes'
          : kind === 'expenseType'
            ? 'expense_types'
            : 'payment_methods';
      const result = await supabase
        .from(table)
        .update({ name })
        .eq('id', id)
        .eq('family_id', familyId)
        .select('id,name,active')
        .single();
      if (result.error)
        return result.error.code === '42501'
          ? 'Chỉ owner mới có quyền sửa danh mục.'
          : result.error.message;
      const replace = (items: CatalogItem[]) =>
        items.map((item) => (item.id === id ? { ...item, name } : item));
      if (kind === 'purpose') setPurposes(replace);
      else if (kind === 'expenseType') setExpenseTypes(replace);
      else setPaymentMethods(replace);
      return null;
    },
    [familyId, purposes, expenseTypes, paymentMethods],
  );

  const deleteCatalogItem = useCallback(
    async (kind: CatalogKind, id: string) => {
      if (!familyId) return 'Không tìm thấy gia đình hiện tại.';
      const { data, error: rpcError } = await supabase.rpc(
        'delete_catalog_item',
        { p_family_id: familyId, p_kind: kind, p_item_id: id },
      );
      if (rpcError) {
        if (rpcError.message.includes('CATALOG_IN_USE'))
          return 'Không thể xóa vì danh mục đã được sử dụng trong bảng giao dịch.';
        if (rpcError.message.includes('FORBIDDEN') || rpcError.code === '42501')
          return 'Chỉ owner mới có quyền xóa danh mục.';
        return rpcError.message;
      }
      if (data !== true) return 'Không tìm thấy danh mục cần xóa.';
      const remove = (items: CatalogItem[]) =>
        items.filter((item) => item.id !== id);
      if (kind === 'purpose') setPurposes(remove);
      else if (kind === 'expenseType') setExpenseTypes(remove);
      else setPaymentMethods(remove);
      return null;
    },
    [familyId],
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
      if (updateError) return updateError.message;
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
      const { data, error: rpcError } = await supabase.rpc(
        'update_family_name',
        { p_family_id: familyId, p_name: name },
      );
      if (rpcError)
        return rpcError.message.includes('FORBIDDEN')
          ? 'Chỉ chủ gia đình mới được đổi tên gia đình.'
          : rpcError.message;
      setFamilyName(String(data));
      return null;
    },
    [familyId],
  );

  const createFamily = useCallback(async (rawName: string) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) return 'Vui lòng nhập tên gia đình.';
    if (name.length > 100) return 'Tên gia đình không được dài quá 100 ký tự.';
    const { error: rpcError } = await supabase.rpc(
      'create_family_with_defaults',
      { p_name: name },
    );
    if (!rpcError) return null;
    if (rpcError.message.includes('ALREADY_HAS_FAMILY'))
      return 'Tài khoản này đã thuộc một gia đình.';
    if (rpcError.message.includes('INVALID_NAME'))
      return 'Tên gia đình không hợp lệ.';
    return rpcError.message;
  }, []);

  const deleteFamily = useCallback(async () => {
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
      return rpcError.message;
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
      currentUserId,
      currentUserRole,
      purposes,
      expenseTypes,
      paymentMethods,
      transactions,
      setTransactions,
      online: navigator.onLine,
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
      currentUserId,
      currentUserRole,
      purposes,
      expenseTypes,
      paymentMethods,
      transactions,
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
