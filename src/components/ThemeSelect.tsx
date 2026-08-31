import { Globe2, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useOptionalLanguage } from '../context/LanguageContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { language, setLanguage, t } = useOptionalLanguage();
  const Icon = preference === 'dark' ? Moon : Sun;
  const Switch = ({ checked, onClick, ariaLabel, kind }: { checked: boolean; onClick: () => void; ariaLabel: string; kind: 'theme' | 'language' }) => <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} onClick={onClick} className={`relative inline-flex h-8 w-16 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${checked ? 'bg-[#155e46]' : 'bg-gray-300 dark:bg-gray-600'}`}><span className={`grid size-6 place-items-center rounded-full bg-white text-[10px] font-extrabold shadow-sm transition-transform ${checked ? 'translate-x-7' : 'translate-x-0'}`}>{kind === 'theme' ? (checked ? <Moon size={14} className="text-[#155e46]" aria-hidden="true" /> : <Sun size={14} className="text-amber-600" aria-hidden="true" />) : (checked ? 'EN' : 'VI')}</span></button>;
  if (compact) return <div className="flex items-center gap-3"><Icon size={18} aria-hidden="true" /><Switch kind="theme" checked={preference === 'dark'} onClick={() => setPreference(preference === 'dark' ? 'light' : 'dark')} ariaLabel={t('theme')} /></div>;
  return <div className="grid w-full grid-cols-[24px_minmax(0,1fr)_64px] items-center gap-x-3 gap-y-3"><Icon size={22} aria-hidden="true" /><span className="whitespace-nowrap text-sm font-medium">{t('theme')}</span><Switch kind="theme" checked={preference === 'dark'} onClick={() => setPreference(preference === 'dark' ? 'light' : 'dark')} ariaLabel={t('theme')} /><Globe2 size={22} aria-hidden="true" /><span className="whitespace-nowrap text-sm font-medium">{t('language')}</span><Switch kind="language" checked={language === 'en'} onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} ariaLabel={t('language')} /></div>;
}
