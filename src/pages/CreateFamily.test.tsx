import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useApp } from '../context/AppContext';
import { CreateFamily } from './CreateFamily';
vi.mock('../context/AppContext', () => ({ useApp: vi.fn() }));
describe('CreateFamily', () => {
  it('hiển thị form cho tài khoản chưa có gia đình', () => {
    vi.mocked(useApp).mockReturnValue({
      authenticated: true,
      loading: false,
      familyId: '',
      createFamily: vi.fn(),
    } as unknown as ReturnType<typeof useApp>);
    render(
      <MemoryRouter>
        <CreateFamily />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Tạo gia đình mới' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tạo gia đình' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Đăng xuất' }),
    ).toBeInTheDocument();
  });
});
