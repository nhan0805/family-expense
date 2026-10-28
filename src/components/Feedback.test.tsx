import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FeedbackProvider, useFeedback } from './Feedback';

function Harness() {
  const { notify, askConfirm } = useFeedback();
  return <><button onClick={() => notify('Đã lưu thành công')}>Toast</button><button onClick={() => void askConfirm({ title: 'Xóa giao dịch?', description: 'Không thể hoàn tác', danger: true })}>Confirm</button></>;
}

function QueueHarness() {
  const { askConfirm } = useFeedback();
  return <button onClick={() => {
    void askConfirm({ title: 'Xác nhận thứ nhất', description: 'Mô tả thứ nhất' });
    void askConfirm({ title: 'Xác nhận thứ hai', description: 'Mô tả thứ hai' });
  }}>Xếp hàng confirm</button>;
}

describe('Feedback', () => {
  afterEach(cleanup);
  it('hiển thị toast và dialog xác nhận có accessible role', () => {
    render(<FeedbackProvider><Harness/></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Toast' }));
    expect(screen.getByText('Đã lưu thành công')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Xóa giao dịch?');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });

  it('xử lý tuần tự nhiều yêu cầu confirm thay vì ghi đè Promise trước', async () => {
    render(<FeedbackProvider><QueueHarness /></FeedbackProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Xếp hàng confirm' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Xác nhận thứ nhất');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent('Xác nhận thứ hai'));
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  });
});
