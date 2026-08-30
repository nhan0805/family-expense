import { Globe2, Laptop, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemePreference } from '../context/ThemeContext';
import { useOptionalLanguage } from '../context/LanguageContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { language, setLanguage, t } = useOptionalLanguage();
  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : Laptop;
  if (compact) {
    return <label className="flex items-center gap-3">
      <span className="sr-only">{t('theme')}</span>
      <select
        className="max-w-28 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        aria-label={language === 'en' ? 'Appearance mode' : 'Chế độ giao diện'}
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">{t('system')}</option>
        <option value="light">{t('light')}</option>
        <option value="dark">{t('dark')}</option>
      </select>
    </label>;
  }

  return <div className="grid w-full grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
    <label className="contents">
      <span className="flex min-w-0 items-center gap-2">
        <Icon size={18} aria-hidden="true" />
        <span className="whitespace-nowrap text-sm font-medium">{t('theme')}</span>
      </span>
      <select
        className="w-full min-w-0 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        aria-label={language === 'en' ? 'Appearance mode' : 'Chế độ giao diện'}
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        <option value="system">{t('system')}</option>
        <option value="light">{t('light')}</option>
        <option value="dark">{t('dark')}</option>
      </select>
    </label>
    <label className="contents">
      <span className="flex min-w-0 items-center gap-2">
        <Globe2 size={18} aria-hidden="true" />
        <span className="whitespace-nowrap text-sm font-medium">{t('language')}</span>
      </span>
      <select
        className="w-full min-w-0 rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        aria-label={t('language')}
        value={language}
        onChange={(event) => setLanguage(event.target.value as 'vi' | 'en')}
      >
        <option value="vi">VI</option>
        <option value="en">EN</option>
      </select>
    </label>
  </div>;
}
