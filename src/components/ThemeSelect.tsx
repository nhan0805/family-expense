import { Globe2, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useOptionalLanguage } from '../context/LanguageContext';

export function ThemeSelect({ compact = false }: { compact?: boolean }) {
  const { preference, setPreference } = useTheme();
  const { language, setLanguage, t } = useOptionalLanguage();
  const Icon = preference === 'dark' ? Moon : Sun;
  const Switch = ({ label, checked, onClick, ariaLabel }: { label: string; checked: boolean; onClick: () => void; ariaLabel: string }) => <div className="flex min-w-0 items-center gap-2"><span className="whitespace-nowrap text-sm font-medium">{label}</span><button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} onClick={onClick} className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${checked ? 'bg-[#155e46]' : 'bg-gray-300 dark:bg-gray-600'}`}><span className={`size-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} /></button></div>;
  return <div className={`${compact ? 'flex items-center gap-3' : 'flex w-full flex-col items-stretch gap-3'}`}><div className={`flex min-w-0 items-center gap-2 ${compact ? '' : 'w-full'}`}>
    <Icon size={18} aria-hidden="true" />
    <Switch label={compact ? '' : t('theme')} checked={preference === 'dark'} onClick={() => setPreference(preference === 'dark' ? 'light' : 'dark')} ariaLabel={t('theme')} />
  </div>{!compact && <div className="flex min-w-0 items-center gap-2"><Globe2 size={18} aria-hidden="true" /><Switch label={t('language')} checked={language === 'en'} onClick={() => setLanguage(language === 'en' ? 'vi' : 'en')} ariaLabel={t('language')} /></div>}</div>;
}
