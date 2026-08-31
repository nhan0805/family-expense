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
    fireEvent.click(screen.getByRole('switch', { name: 'Giao diện' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('family-expense-theme')).toBe('dark');
  });

  it('chuyển về sáng bằng switch và lưu lựa chọn', () => {
    window.localStorage.setItem('family-expense-theme', 'dark');
    render(<ThemeProvider><ThemeSelect/></ThemeProvider>);
    fireEvent.click(screen.getByRole('switch', { name: 'Giao diện' }));
    expect(window.localStorage.getItem('family-expense-theme')).toBe('light');
  });
});
