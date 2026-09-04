import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '../context/LanguageContext';
import { Login } from './Login';

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signInWithPassword,
      signUp: vi.fn(),
      signInWithOtp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
    },
  },
}));

const renderLogin = () => render(
  <LanguageProvider>
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  </LanguageProvider>,
);

afterEach(() => vi.clearAllMocks());

describe('xác thực tài khoản', () => {
  it('chặn gửi form khi thiếu email hoặc mật khẩu', () => {
    renderLogin();
    const form = screen.getByRole('button', { name: 'Tiếp tục' }).closest('form');
    fireEvent.submit(form!);

    expect(screen.getByRole('status')).toHaveTextContent('Vui lòng nhập email.');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('dịch lỗi đăng nhập và luôn mở lại nút sau khi provider từ chối', async () => {
    signInWithPassword.mockRejectedValueOnce(new Error('Invalid login credentials'));
    renderLogin();
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'demo@example.com' } });
    fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'secret123' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tiếp tục' }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Email hoặc mật khẩu không đúng.'));
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
    expect(screen.queryByText('Invalid login credentials')).not.toBeInTheDocument();
  });
});
