import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import { Catalogs } from './Catalogs';

vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));

const mockedUseApp = vi.mocked(useApp);
const addCatalogItem = vi.fn();
const updateCatalogItem = vi.fn();
const deleteCatalogItem = vi.fn();

function appState(role: 'owner' | 'member') {
  return {
    currentUserRole: role,
    purposes: [
      { id: 'p1', name: 'Sinh hoạt', icon: 'house', budgetEnabled: true },
      { id: 'p2', name: 'Nhà cửa & gia dụng', icon: 'house', budgetEnabled: false },
    ],
    expenseTypes: [{ id: 'e1', name: 'Thực phẩm', icon: 'shopping-basket' }],
    paymentMethods: [{ id: 'm1', name: 'Tiền mặt', icon: 'banknote' }],
    addCatalogItem,
    updateCatalogItem,
    deleteCatalogItem,
  } as unknown as ReturnType<typeof useApp>;
}

describe('Quản lý danh mục', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    addCatalogItem.mockResolvedValue(null);
    updateCatalogItem.mockResolvedValue(null);
    deleteCatalogItem.mockResolvedValue(null);
  });

  it('cho owner thêm danh mục', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    render(<Catalogs />);

    expect(screen.getByRole('heading', { name: 'Danh mục', level: 2 })).toHaveClass('page-title');
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
    expect(screen.getByRole('tab', { name: 'Mục đích' })).toHaveAttribute('aria-selected', 'true');
    const hiddenBudgetName = screen.getByText('Nhà cửa & gia dụng');
    expect(hiddenBudgetName).toHaveClass('block', 'whitespace-normal', 'break-words', 'lg:whitespace-nowrap');
    expect(hiddenBudgetName).not.toHaveClass('truncate');
    expect(hiddenBudgetName.parentElement).toHaveClass('min-w-0', 'flex-1');
    expect(hiddenBudgetName.parentElement).toContainElement(screen.getByText('Ẩn ngân sách'));
    expect(screen.getByText('Ẩn ngân sách')).toHaveClass('w-fit', 'whitespace-nowrap');
    fireEvent.click(screen.getAllByRole('button', { name: 'Thêm' })[0]!);
    fireEvent.change(screen.getByLabelText('Tên mục đích'), { target: { value: '  Giáo dục  ' } });
    fireEvent.change(screen.getByLabelText('Tìm biểu tượng cho Mục đích'), { target: { value: 'xe đạp' } });
    fireEvent.click(screen.getByRole('option', { name: 'Bike' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu danh mục' }));

    await waitFor(() => expect(addCatalogItem).toHaveBeenCalledWith('purpose', '  Giáo dục  ', '', 'bike', true));
  });

  it('cho phép chuyển giữa các nhóm bằng tab', () => {
    mockedUseApp.mockReturnValue(appState('member'));
    render(<Catalogs />);

    fireEvent.click(screen.getByRole('tab', { name: 'Danh mục' }));

    expect(screen.getByRole('tab', { name: 'Danh mục' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'catalog-tab-expenseType');
    expect(screen.getByRole('heading', { name: 'Danh mục', level: 3 })).toBeVisible();
    expect(screen.getByText('Thực phẩm')).toBeVisible();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1);
  });

  it('cho owner đổi tên và xóa danh mục', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Catalogs />);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Sinh hoạt' }));
    fireEvent.change(screen.getByLabelText('Đổi tên mục đích'), { target: { value: 'Gia đình' } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tên mới' }));
    await waitFor(() => expect(updateCatalogItem).toHaveBeenCalledWith('purpose', 'p1', 'Gia đình', '', 'house', true));

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Sinh hoạt' }));
    await waitFor(() => expect(deleteCatalogItem).toHaveBeenCalledWith('purpose', 'p1'));
  });

  it('chỉ cho member xem danh mục', () => {
    mockedUseApp.mockReturnValue(appState('member'));
    render(<Catalogs />);

    expect(screen.getByText('Chỉ chủ gia đình mới có quyền chỉnh sửa.', { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Thêm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sửa Sinh hoạt' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Xóa Sinh hoạt' })).not.toBeInTheDocument();
  });

  it('cho owner ẩn mục đích khỏi ngân sách nhưng vẫn giữ mục đích', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    render(<Catalogs />);

    fireEvent.click(screen.getByRole('button', { name: 'Sửa Sinh hoạt' }));
    const budgetToggle = screen.getByRole('checkbox', { name: 'Theo dõi trong ngân sách' });
    expect(budgetToggle).toBeChecked();
    fireEvent.click(budgetToggle);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tên mới' }));

    await waitFor(() => expect(updateCatalogItem).toHaveBeenCalledWith('purpose', 'p1', 'Sinh hoạt', '', 'house', false));
  });

  it('hiển thị lỗi nghiệp vụ từ database', async () => {
    mockedUseApp.mockReturnValue(appState('owner'));
    deleteCatalogItem.mockResolvedValue('Không thể xóa vì danh mục đã được sử dụng trong bảng giao dịch.');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Catalogs />);

    fireEvent.click(screen.getByRole('button', { name: 'Xóa Sinh hoạt' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể xóa vì danh mục đã được sử dụng');
  });
});
