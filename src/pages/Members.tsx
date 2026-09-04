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
  return 'Không thể hoàn tất thao tác thành viên. Vui lòng thử lại.';
};

export function Members() {
  const { language, t } = useOptionalLanguage();
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
    if (!isSupabaseConfigured) {
      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
        setBusy(false);
        setMessage('Vui lòng nhập email thành viên.');
        return;
      }
      if (members.some((member) => member.email.toLowerCase() === normalizedEmail.toLowerCase())) {
        setBusy(false);
        setMessage('Email này đã có trong danh sách thành viên.');
        return;
      }
      setMembers((items) => [
        ...items,
        {
          id: `local-member-${crypto.randomUUID()}`,
          user_id: `local-user-${crypto.randomUUID()}`,
          display_name: displayName.trim() || normalizedEmail,
          email: normalizedEmail,
          role: 'member',
          status: 'active',
          created_at: new Date().toISOString(),
        },
      ]);
      setEmail('');
      setDisplayName('');
      setBusy(false);
      setMessage('Đã thêm thành viên demo.');
      return;
    }
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
    if (!isSupabaseConfigured) {
      const name = editingName.trim();
      if (!name) {
        setBusy(false);
        setMessage('Tên hiển thị không được để trống.');
        return;
      }
      setMembers((items) => items.map((member) => member.id === editingId ? { ...member, display_name: name } : member));
      setEditingId(null);
      setEditingName('');
      setBusy(false);
      setMessage('Đã cập nhật tên hiển thị demo.');
      return;
    }
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
    if (!isSupabaseConfigured) {
      setMembers((items) => items.filter((item) => item.id !== member.id));
      setBusy(false);
      setMessage('Đã xóa thành viên demo khỏi gia đình.');
      return;
    }
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
    <section className="members-page space-y-6">
      <div className="page-header">
        <p className="page-kicker">{en ? 'Family space' : 'Không gian gia đình'}</p>
        {editingFamily ? (
          <form className="family-name-editor" onSubmit={saveFamilyName}>
            <input
              aria-label={en ? 'New family name' : 'Tên gia đình mới'}
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
              aria-label={en ? 'Cancel family name edit' : 'Hủy sửa tên gia đình'}
              className="btn-secondary shrink-0"
              onClick={() => setEditingFamily(false)}
            >
              <X size={17} />
            </button>
          </form>
        ) : (
          <div className="family-header">
            <h2 className="page-title mt-0">{familyName}</h2>
            {isOwner && (
              <button
                type="button"
                title={en ? 'Edit family name' : 'Sửa tên gia đình'}
                aria-label={en ? 'Edit family name' : 'Sửa tên gia đình'}
                className="icon-button"
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
        <p className="page-subtitle">
              {en ? 'Family members share the family transactions and reports.' : 'Thành viên dùng chung dữ liệu giao dịch và báo cáo của gia đình.'}
        </p>
      </div>
      {message && (
        <p
          role="status"
          className="inline-feedback"
        >
          {message}
        </p>
      )}
      {isOwner && (
        <form
          className="member-invite-card card grid gap-4 p-4 sm:grid-cols-2 sm:p-6"
          onSubmit={addMember}
        >
          <div className="form-section-heading form-section-heading-primary sm:col-span-2">
            <h3 className="flex items-center gap-2 font-bold">
              <UserPlus size={20} />
              {en ? 'Add member' : 'Thêm thành viên'}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
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
      <div className="member-list-card card">
        <div className="section-header border-b border-black/10 p-4 dark:border-white/10 sm:p-5">
          <h3 className="font-bold">{en ? 'Member list' : 'Danh sách thành viên'} ({members.length})</h3>
        </div>
        <div className="divide-y divide-black/10 dark:divide-white/10" aria-busy={loadingMembers}>
          {loadingMembers ? <div className="space-y-4 p-5" role="status" aria-label={en ? 'Loading members' : 'Đang tải thành viên'}><span className="sr-only">{en ? 'Loading members…' : 'Đang tải thành viên…'}</span>{Array.from({ length: 2 }, (_, index) => <div className="flex items-center justify-between gap-4" key={index}><div className="flex-1 space-y-2"><Skeleton className="h-5 w-40"/><Skeleton className="h-4 w-56 max-w-full"/></div><Skeleton className="h-10 w-20"/></div>)}</div> : members.map((member) => {
            const isCurrentUser = member.user_id === currentUserId;
            return <article className={`member-row p-4 sm:p-5 ${isCurrentUser ? 'member-row-current' : ''}`} aria-label={isCurrentUser ? `${member.display_name}, ${t('currentAccount')}` : undefined} key={member.id}>
              {editingId === member.id ? (
                <form
                  className="member-name-editor flex flex-col gap-2 sm:flex-row"
                  onSubmit={updateName}
                >
                  <input
                    aria-label={en ? 'New display name' : 'Tên hiển thị mới'}
                    className="field"
                    autoFocus
                    required
                    maxLength={100}
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button className="btn-primary shrink-0" disabled={busy}>
                    {busy ? (en ? 'Saving…' : 'Đang lưu…') : (en ? 'Save name' : 'Lưu tên')}
                  </button>
                  <button
                    type="button"
                    aria-label={en ? 'Cancel rename' : 'Hủy đổi tên'}
                    className="btn-secondary shrink-0"
                    onClick={() => setEditingId(null)}
                  >
                    <X size={17} />
                  </button>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="member-avatar" aria-hidden="true">{member.display_name.trim().slice(0, 1).toUpperCase() || '?'}</span>
                    <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong>{member.display_name}</strong>
                      {isCurrentUser && <span className="current-user-badge">{t('you')}</span>}
                      <span className="status-badge">
                        {member.role === 'owner'
                          ? (en ? 'Family owner' : 'Chủ gia đình')
                          : (en ? 'Member' : 'Thành viên')}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {(isOwner || member.user_id === currentUserId) && (
                      <button
                        type="button"
                        title={`${en ? 'Rename' : 'Đổi tên'} ${member.display_name}`}
                        aria-label={`${en ? 'Rename' : 'Đổi tên'} ${member.display_name}`}
                        className="icon-button border border-gray-200 dark:border-gray-700"
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
                        aria-label={`${en ? 'Remove' : 'Xóa'} ${member.display_name}`}
                        className="danger-button flex items-center gap-1 px-3 py-2 text-sm"
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
          })}
          {!loadingMembers && members.length === 0 && (
            <EmptyState
              title={en ? 'No members yet' : 'Chưa có thành viên'}
              description={isOwner
                ? (en ? 'Add a member using an email registered with Family Expense.' : 'Thêm thành viên bằng email đã đăng ký Family Expense.')
                : (en ? 'There are currently no family members to display.' : 'Gia đình hiện chưa có thành viên để hiển thị.')}
            />
          )}
        </div>
      </div>
      {!isOwner && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {en ? 'Only the family owner can add members.' : 'Chỉ chủ gia đình mới có thể thêm thành viên.'}
        </p>
      )}
      {isOwner && (
        <section className="danger-zone card p-5">
          <h3 className="font-bold text-red-700 dark:text-[#ff5555]">
            {en ? 'Delete family' : 'Xóa gia đình'}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {canDeleteFamily === false
              ? (en ? 'Delete all transactions before deleting the family.' : 'Hãy xóa hết giao dịch trước khi xóa gia đình.')
              : canDeleteFamily === null
                ? (en ? 'Checking deletion requirements…' : 'Đang kiểm tra điều kiện xóa…')
                : (en ? 'No active transactions remain; the family can be deleted.' : 'Không còn giao dịch hoạt động; gia đình có thể xóa.')}
          </p>
          <button
            type="button"
            className="danger-button mt-4 px-4"
            disabled={busy || canDeleteFamily !== true}
            onClick={() => void removeFamily()}
          >
            <Trash2 className="mr-2 inline" size={17} />
            {en ? 'Delete family' : 'Xóa gia đình'}
          </button>
        </section>
      )}
    </section>
  );
}
