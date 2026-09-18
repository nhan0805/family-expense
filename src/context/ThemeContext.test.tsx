import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeSelect } from '../components/ThemeSelect';
import { ThemeProvider } from './ThemeContext';

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    document.documentElement.classList.remove('dark');
  });

  it('lưu lựa chọn tối và áp class trước toàn ứng dụng', () => {
    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Giao diện' }), { target: { value: 'dark' } });
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('family-expense-theme')).toBe('dark');
  });

  it('chuyển về sáng bằng switch và lưu lựa chọn', () => {
    window.localStorage.setItem('family-expense-theme', 'dark');
    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);
    fireEvent.change(screen.getByRole('combobox', { name: 'Giao diện' }), { target: { value: 'light' } });
    expect(window.localStorage.getItem('family-expense-theme')).toBe('light');
  });

  it('theo dark mode của hệ điều hành khi người dùng chưa chọn theme', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('family-expense-theme')).toBeNull();
  });

  it('cập nhật khi hệ điều hành đổi preference và người dùng đang chọn theo thiết bị', () => {
    let listener: ((event: MediaQueryListEvent) => void) | undefined;
    const media = {
      matches: false,
      addEventListener: vi.fn((_event: string, callback: (event: MediaQueryListEvent) => void) => {
        listener = callback;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue(media),
    });

    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);
    expect(document.documentElement).not.toHaveClass('dark');
    listener?.({ matches: true } as MediaQueryListEvent);
    return waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });

  it('dùng nền Dracula cho màu thanh hệ thống', () => {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.append(meta);
    window.localStorage.setItem('family-expense-theme', 'dark');

    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);

    expect(meta.content).toBe('#282a36');
    meta.remove();
  });
});
