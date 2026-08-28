import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FeedbackProvider, useFeedback } from './Feedback';

function Harness() {
  const { notify, askConfirm } = useFeedback();
  return <><button onClick={() => notify('Đã lưu thành công')}>Toast</button><button onClick={() => void askConfirm({ title: 'Xóa giao dịch?', description: 'Không thể hoàn tác', danger: true })}>Confirm</button></>;
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
});
