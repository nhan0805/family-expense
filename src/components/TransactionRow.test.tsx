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
});
