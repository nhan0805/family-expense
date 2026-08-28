import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.change(screen.getByLabelText('Chế độ giao diện'), { target: { value: 'dark' } });
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('family-expense-theme')).toBe('dark');
  });

  it('xóa lựa chọn cứng khi chuyển về theo thiết bị', () => {
    window.localStorage.setItem('family-expense-theme', 'light');
    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);
    fireEvent.change(screen.getByLabelText('Chế độ giao diện'), { target: { value: 'system' } });
    expect(window.localStorage.getItem('family-expense-theme')).toBeNull();
  });
});
