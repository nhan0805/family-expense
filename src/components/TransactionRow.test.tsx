import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { TransactionRow } from './TransactionRow';
import type { Transaction } from '../lib/domain';

const transaction: Transaction = {
  id: 'tx-1',
  transactionDate: '2026-08-30',
  transactionType: 'Chi tiêu',
  status: 'Thực tế',
  description: 'Mua thực phẩm',
  amount: 120000,
  purposeId: 'purpose-1',
  expenseTypeId: 'expense-1',
  paymentMethodId: 'payment-1',
  source: 'manual',
  sourceReference: null,
  aiGenerated: false,
};

const renderRow = (overrides: Partial<React.ComponentProps<typeof TransactionRow>> = {}) => {
  const props: React.ComponentProps<typeof TransactionRow> = {
    transaction,
    purposeName: 'Sinh hoạt',
    expenseTypeName: 'Thực phẩm',
    paymentMethodName: 'Tiền mặt',
    showTrash: false,
    selectMode: false,
    selected: false,
    openMenu: false,
    deleting: false,
    copying: false,
    currentUserRole: 'owner',
    currentUserId: 'user-1',
    onToggleSelected: vi.fn(),
    onSetSelected: vi.fn(),
    onToggleMenu: vi.fn(),
    onRestore: vi.fn(),
    onPermanentlyDelete: vi.fn(),
    onCopy: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  return render(<MemoryRouter><TransactionRow {...props} /></MemoryRouter>);
};

describe('TransactionRow', () => {
  it('hiển thị giao dịch và các nhãn phân loại', () => {
    renderRow();
    expect(screen.getAllByText('Mua thực phẩm').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Thực phẩm').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/120\.000/).length).toBeGreaterThan(0);
  });

  it('hiển thị icon danh mục ở mobile và desktop', () => {
    renderRow({ purposeIcon: 'house', expenseTypeIcon: 'utensils', paymentMethodIcon: 'banknote' });
    expect(document.querySelectorAll('.catalog-tag-icon')).toHaveLength(3);
    expect(document.querySelectorAll('.catalog-value-icon')).toHaveLength(3);
  });

  it('mở menu thao tác khi người dùng bấm nút trên mobile', () => {
    const onToggleMenu = vi.fn();
    renderRow({ onToggleMenu });
    fireEvent.click(screen.getAllByRole('button', { name: 'Thao tác với Mua thực phẩm' })[0]!);
    expect(onToggleMenu).toHaveBeenCalledWith('tx-1');
  });

  it('hiển thị thao tác khôi phục trong thùng rác', () => {
    const onRestore = vi.fn();
    renderRow({ showTrash: true, onRestore });
    fireEvent.click(screen.getAllByRole('button', { name: 'Khôi phục Mua thực phẩm' })[0]!);
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it('đặt nút thao tác desktop cạnh số tiền để giảm cuộn ngang', () => {
    renderRow();
    const desktopRow = document.querySelector<HTMLElement>('.transaction-table-row');
    expect(desktopRow).toHaveClass('w-full', 'md:min-w-[1080px]');
    expect(desktopRow?.className).toContain('md:grid-cols-[80px_minmax(180px,1fr)_190px_160px_190px_220px]');

    const amount = desktopRow?.querySelector('.transaction-row-amount');
    const actions = desktopRow?.querySelector('.transaction-row-actions');
    expect(amount?.parentElement).toBe(actions?.parentElement);
    expect(actions).toHaveClass('w-[72px]', 'grid-cols-2');
  });

  it('giữ tên mục đích và các nút desktop trong vùng cột riêng', () => {
    renderRow({ purposeName: 'Sinh hoạt gia đình' });
    const desktopRow = document.querySelector<HTMLElement>('.transaction-table-row');
    const purpose = desktopRow?.querySelector('.catalog-value-icon')?.parentElement;
    expect(purpose).toHaveClass('overflow-hidden');
    expect(purpose?.querySelector('span:last-child')).toHaveClass('flex-1', 'truncate');
  });
});
