import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackProvider } from '../components/Feedback';
import { useApp } from '../context/AppContext';
import { SystemCatalogDefaultsSettings } from './SystemCatalogDefaultsSettings';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

const mockedUseApp = vi.mocked(useApp);
const saveCurrentCatalogsAsSystemDefault = vi.fn();

function appState(role: 'owner' | 'member') {
  return {
    familyId: 'family-template',
    currentUserRole: role,
    purposes: [{ id: 'p1', name: 'Đầu tư' }],
    expenseTypes: [{ id: 'e1', name: 'Vàng' }, { id: 'e2', name: 'Ăn uống' }],
    paymentMethods: [{ id: 'm1', name: 'Chuyển khoản' }],
    saveCurrentCatalogsAsSystemDefault,
  } as unknown as ReturnType<typeof useApp>;
}

describe('mặc định danh mục cho gia đình mới', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    saveCurrentCatalogsAsSystemDefault.mockResolvedValue(null);
  });

  it('owner xác nhận rồi lưu danh mục hiện tại thành bộ mẫu hệ thống', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    render(
      <FeedbackProvider>
        <SystemCatalogDefaultsSettings />
      </FeedbackProvider>,
    );

    expect(screen.getByText('Mục đích')).toBeInTheDocument();
    expect(screen.getAllByText('1', { selector: 'strong' })).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Dùng danh mục hiện tại cho gia đình mới' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Đặt làm mặc định hệ thống' }));

    await waitFor(() => expect(saveCurrentCatalogsAsSystemDefault).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Đã lưu danh mục mặc định cho các gia đình mới.')).toBeInTheDocument();
  });

  it('member không được thay đổi bộ mẫu hệ thống', () => {
    mockedUseApp.mockReturnValue(appState('member'));
    render(
      <FeedbackProvider>
        <SystemCatalogDefaultsSettings />
      </FeedbackProvider>,
    );

    expect(screen.getByText('Chỉ chủ gia đình', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dùng danh mục hiện tại cho gia đình mới' })).toBeDisabled();
  });
});
