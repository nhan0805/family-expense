import { Globe2, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { useOptionalLanguage } from '../context/LanguageContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { language, setLanguage, t } = useOptionalLanguage();
  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Laptop;
  return <div className={`${compact ? 'flex items-center gap-3' : 'flex w-full flex-col items-stretch gap-2'}`}><label className={`flex min-w-0 items-center gap-2 ${compact ? '' : 'w-full'}`}>
    <Icon size={18} aria-hidden="true" />
    {!compact && <span className="whitespace-nowrap text-sm font-medium">{t('theme')}</span>}
    <select
      className={`rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15 ${compact ? 'max-w-28' : 'ml-auto'}`}
      aria-label="Chế độ giao diện"
      value={preference}
      onChange={(event) => setPreference(event.target.value as ThemePreference)}
    >
      <option value="system">{t('system')}</option>
      <option value="light">{t('light')}</option>
      <option value="dark">{t('dark')}</option>
    </select>
  </label>{!compact && <label className="flex min-w-0 items-center gap-2"><Globe2 size={18} aria-hidden="true" /><span className="whitespace-nowrap text-sm font-medium">{t('language')}</span><select className="ml-auto min-w-0 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15" aria-label={t('language')} value={language} onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}><option value="vi">VI</option><option value="en">EN</option></select></label>}</div>;
}
