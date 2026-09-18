import { Globe2, Moon, Sun } from 'lucide-react';
import { useOptionalTheme } from '../context/ThemeContext';
import { useOptionalLanguage } from '../context/LanguageContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, resolvedTheme, setPreference } = useOptionalTheme();
  const { language, setLanguage, t } = useOptionalLanguage();
  const Icon = resolvedTheme === 'dark' ? Moon : Sun;
  const Switch = ({ checked, onClick, ariaLabel, kind }: { checked: boolean; onClick: () => void; ariaLabel: string; kind: 'theme' | 'language' }) => <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} onClick={onClick} className={`relative inline-flex min-h-11 w-16 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${kind === 'language' ? (checked ? 'bg-[var(--primary)]' : 'bg-slate-500 dark:bg-slate-600') : (checked ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-[var(--border-strong)]')}`}><span className={`grid size-8 place-items-center rounded-full bg-white text-[10px] font-extrabold shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-0'} ${kind === 'language' ? 'text-[var(--primary)] dark:text-[var(--primary-contrast)]' : ''}`}>{kind === 'theme' ? (checked ? <Moon size={14} className="text-[var(--primary)] dark:text-[var(--primary-contrast)]" aria-hidden="true" /> : <Sun size={14} className="text-amber-600" aria-hidden="true" />) : (checked ? 'EN' : 'VI')}</span></button>;
  const themeOptions = <>
    <option value="system">{t('system')}</option>
    <option value="light">{t('light')}</option>
    <option value="dark">{t('dark')}</option>
  </>;
  if (compact) return <div className="flex min-w-0 items-center justify-end gap-2"><Icon size={18} aria-hidden="true" /><select className="field min-h-11 min-w-0 py-2 text-sm" value={preference} aria-label={t('theme')} onChange={(event) => setPreference(event.target.value as 'light' | 'dark' | 'system')}>{themeOptions}</select><Switch kind="language" checked={language === 'en'} onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} ariaLabel={t('language')} /></div>;
  return <div className="grid w-full grid-cols-[24px_minmax(0,1fr)_minmax(0,7rem)] items-center gap-x-3 gap-y-3"><Icon size={22} aria-hidden="true" /><span className="whitespace-nowrap text-sm font-medium">{t('theme')}</span><select className="field min-h-11 min-w-0 py-2 text-sm" value={preference} aria-label={t('theme')} onChange={(event) => setPreference(event.target.value as 'light' | 'dark' | 'system')}>{themeOptions}</select><Globe2 size={22} aria-hidden="true" /><span className="whitespace-nowrap text-sm font-medium">{t('language')}</span><Switch kind="language" checked={language === 'en'} onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} ariaLabel={t('language')} /></div>;
}
