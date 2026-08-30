import { useCallback, useEffect, useState } from 'react';
import { Pencil, Trash2, UserPlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useOptionalLanguage } from '../context/LanguageContext';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { EmptyState, Skeleton } from '../components/AsyncStates';

type Member = {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  role: 'owner' | 'member';
  status: 'active' | 'invited' | 'disabled';
  created_at: string;
};

const friendlyError = (message: string) => {
  if (message.includes('USER_NOT_FOUND'))
    return 'Chưa có tài khoản đăng ký bằng email này. Hãy yêu cầu thành viên đăng ký trước.';
  if (message.includes('ALREADY_MEMBER'))
    return 'Tài khoản này đã là thành viên của gia đình.';
  if (message.includes('USER_IN_ANOTHER_FAMILY'))
    return 'Tài khoản này đang thuộc một gia đình khác.';
  if (message.includes('FORBIDDEN'))
    return 'Chỉ chủ gia đình mới được thêm thành viên.';
  return message;
};

export function Members() {
  const { language } = useOptionalLanguage();
  const en = language === 'en';
  const {
    familyId,
    familyName,
    currentUserEmail,
    currentUserId,
    currentUserRole,
    updateFamilyName,
    deleteFamily,
  } = useApp();
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingFamily, setEditingFamily] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState(familyName);
  const isOwner = currentUserRole === 'owner';
  const [canDeleteFamily, setCanDeleteFamily] = useState<boolean | null>(null);

  const loadMembers = useCallback(async () => {
    if (!familyId) return;
    setLoadingMembers(true);
    if (!isSupabaseConfigured) {
      setMembers([
        {
          id: 'local',
          user_id: 'local-user',
          display_name: 'Chủ gia đình',
          email: currentUserEmail || 'demo@family.local',
          role: 'owner',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ]);
      setLoadingMembers(false);
      return;
    }
    const { data, error } = await supabase.rpc('get_family_members', {
      p_family_id: familyId,
    });
    if (error) setMessage(friendlyError(error.message));
    else setMembers((data || []) as Member[]);
    if (isOwner) {
      const eligibility = await supabase.rpc('can_delete_family', { p_family_id: familyId });
      if (!eligibility.error) setCanDeleteFamily(Boolean(eligibility.data));
    }
    setLoadingMembers(false);
  }, [familyId, currentUserEmail, isOwner]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const addMember = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.rpc('add_family_member', {
      p_family_id: familyId,
      p_email: email,
      p_display_name: displayName || null,
    });
    setBusy(false);
    if (error) {
      setMessage(friendlyError(error.message));
      return;
    }
    setEmail('');
    setDisplayName('');
    setMessage(
      'Đã thêm thành viên. Người này có thể đăng nhập để xem dữ liệu gia đình.',
    );
    await loadMembers();
  };

  const updateName = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.rpc('update_family_member_name', {
      p_family_id: familyId,
      p_member_id: editingId,
      p_display_name: editingName,
    });
    setBusy(false);
    if (error) {
      setMessage(
        error.message.includes('INVALID_NAME')
          ? 'Tên hiển thị không được để trống.'
          : friendlyError(error.message),
      );
      return;
    }
    setEditingId(null);
    setEditingName('');
    setMessage('Đã cập nhật tên hiển thị.');
    await loadMembers();
  };

  const removeMember = async (member: Member) => {
    if (
      !window.confirm(
        `Xóa ${member.display_name} khỏi gia đình? Người này sẽ mất quyền truy cập nhưng giao dịch cũ vẫn được giữ lại.`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    const { error } = await supabase.rpc('remove_family_member', {
      p_family_id: familyId,
      p_member_id: member.id,
    });
    setBusy(false);
    if (error) {
      setMessage(
        error.message.includes('CANNOT_REMOVE_OWNER')
          ? 'Không thể xóa Chủ gia đình.'
          : friendlyError(error.message),
      );
      return;
    }
    setMessage('Đã xóa thành viên khỏi gia đình.');
    await loadMembers();
  };

  const saveFamilyName = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    const result = await updateFamilyName(familyNameInput);
    setBusy(false);
    if (result) {
      setMessage(result);
      return;
    }
    setEditingFamily(false);
    setMessage('Đã cập nhật tên gia đình.');
  };

  const removeFamily = async () => {
    if (!canDeleteFamily) {
      setMessage('Hãy xóa hết giao dịch trước khi xóa gia đình.');
      return;
    }
    if (
      !window.confirm(
        `Xóa gia đình “${familyName}”? Các giao dịch đã xóa mềm sẽ bị xóa vĩnh viễn. Thao tác này không thể hoàn tác.`,
      )
    )
      return;
    setBusy(true);
    setMessage('');
    const result = await deleteFamily();
    setBusy(false);
    if (result) {
      setMessage(result);
      return;
    }
    window.location.assign('/tao-gia-dinh');
  };

  return (
    <section className="space-y-6">
      <div>
        {editingFamily ? (
          <form className="flex max-w-xl gap-2" onSubmit={saveFamilyName}>
            <input
              aria-label="Tên gia đình mới"
              className="field"
              autoFocus
              required
              maxLength={100}
              value={familyNameInput}
              onChange={(event) => setFamilyNameInput(event.target.value)}
            />
            <button className="btn-primary shrink-0" disabled={busy}>
              {en ? 'Save' : 'Lưu'}
            </button>
            <button
              type="button"
              aria-label="Hủy sửa tên gia đình"
              className="btn-secondary shrink-0"
              onClick={() => setEditingFamily(false)}
            >
              <X size={17} />
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-extrabold">{familyName}</h2>
            {isOwner && (
              <button
                type="button"
                title="Sửa tên gia đình"
                aria-label="Sửa tên gia đình"
                className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => {
                  setFamilyNameInput(familyName);
                  setEditingFamily(true);
                }}
              >
                <Pencil size={18} />
              </button>
            )}
          </div>
        )}
        <p className="mt-1 text-sm text-gray-500">
              {en ? 'Family members share the family transactions and reports.' : 'Thành viên dùng chung dữ liệu giao dịch và báo cáo của gia đình.'}
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="rounded-xl bg-[#e8f4ee] p-3 text-sm dark:bg-[#17382d]"
        >
          {message}
        </p>
      )}
      {isOwner && (
        <form
          className="card grid gap-4 p-5 sm:grid-cols-2"
          onSubmit={addMember}
        >
          <div className="sm:col-span-2">
            <h3 className="flex items-center gap-2 font-bold">
              <UserPlus size={20} />
              {en ? 'Add member' : 'Thêm thành viên'}
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              {en ? 'The email must have a Family Expense account before it can be added.' : 'Email phải đăng ký tài khoản Family Expense trước khi được thêm.'}
            </p>
          </div>
          <label>
            <span className="label">Email *</span>
            <input
              className="field"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            <span className="label">{en ? 'Display name' : 'Tên hiển thị'}</span>
            <input
              className="field"
              maxLength={100}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={en ? 'Optional' : 'Không bắt buộc'}
            />
          </label>
          <button className="btn-primary sm:col-span-2" disabled={busy}>
            {busy ? (en ? 'Adding…' : 'Đang thêm…') : (en ? 'Add to family' : 'Thêm vào gia đình')}
          </button>
        </form>
      )}
      <div className="card overflow-hidden">
        <div className="border-b border-black/10 p-5 dark:border-white/10">
          <h3 className="font-bold">{en ? 'Member list' : 'Danh sách thành viên'} ({members.length})</h3>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10" aria-busy={loadingMembers}>
          {loadingMembers ? <div className="space-y-4 p-5" role="status" aria-label="Đang tải thành viên"><span className="sr-only">Đang tải thành viên…</span>{Array.from({ length: 2 }, (_, index) => <div className="flex items-center justify-between gap-4" key={index}><div className="flex-1 space-y-2"><Skeleton className="h-5 w-40"/><Skeleton className="h-4 w-56 max-w-full"/></div><Skeleton className="h-10 w-20"/></div>)}</div> : members.map((member) => (
            <article className="p-5" key={member.id}>
              {editingId === member.id ? (
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={updateName}
                >
                  <input
                    aria-label="Tên hiển thị mới"
                    className="field"
                    autoFocus
                    required
                    maxLength={100}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button className="btn-primary shrink-0" disabled={busy}>
                    {busy ? 'Đang lưu…' : 'Lưu tên'}
                  </button>
                  <button
                    type="button"
                    aria-label="Hủy đổi tên"
                    className="btn-secondary shrink-0"
                    onClick={() => setEditingId(null)}
                  >
                    <X size={17} />
                  </button>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{member.display_name}</strong>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-700">
                        {member.role === 'owner'
                          ? 'Chủ gia đình'
                          : 'Thành viên'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{member.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {(isOwner || member.user_id === currentUserId) && (
                      <button
                        type="button"
                        title={`Đổi tên ${member.display_name}`}
                        aria-label={`Đổi tên ${member.display_name}`}
                        className="rounded-lg border border-gray-200 p-2 hover:bg-black/5 dark:border-gray-700 dark:hover:bg-white/5"
                        onClick={() => {
                          setEditingId(member.id);
                          setEditingName(member.display_name);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {isOwner && member.role === 'member' && (
                      <button
                        type="button"
                        aria-label={`Xóa ${member.display_name}`}
                        className="flex items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                        disabled={busy}
                        onClick={() => void removeMember(member)}
                      >
                        <Trash2 size={17} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
          {!loadingMembers && members.length === 0 && <EmptyState title="Chưa có thành viên" description={isOwner ? 'Thêm thành viên bằng email đã đăng ký Family Expense.' : 'Gia đình hiện chưa có thành viên để hiển thị.'}/>} 
        </div>
      </div>
      {!isOwner && (
        <p className="text-sm text-gray-500">
          Chỉ chủ gia đình mới có thể thêm thành viên.
        </p>
      )}
      {isOwner && (
        <section className="card border-red-200 p-5 dark:border-red-900">
          <h3 className="font-bold text-red-700 dark:text-red-300">
            Xóa gia đình
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {canDeleteFamily === false
              ? 'Hãy xóa hết giao dịch trước khi xóa gia đình.'
              : canDeleteFamily === null
                ? 'Đang kiểm tra điều kiện xóa…'
                : 'Không còn giao dịch hoạt động; gia đình có thể xóa.'}
          </p>
          <button
            type="button"
            className="mt-4 rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={busy || canDeleteFamily !== true}
            onClick={() => void removeFamily()}
          >
            <Trash2 className="mr-2 inline" size={17} />
            Xóa gia đình
          </button>
        </section>
      )}
    </section>
  );
}
