import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Laptop;
  return <label className={`flex items-center gap-2 ${compact ? '' : 'w-full'}`}>
    <Icon size={18} aria-hidden="true" />
    {!compact && <span className="text-sm font-medium">Giao diện</span>}
    <select
      className={`rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15 ${compact ? 'max-w-28' : 'ml-auto'}`}
      aria-label="Chế độ giao diện"
      value={preference}
      onChange={(event) => setPreference(event.target.value as ThemePreference)}
    >
      <option value="system">Theo thiết bị</option>
      <option value="light">Sáng</option>
      <option value="dark">Tối</option>
    </select>
  </label>;
}
