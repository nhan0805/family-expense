import { Check, ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  getCatalogDisplayName,
  type CatalogItem,
  type CatalogLanguage,
} from '../lib/domain';

type MultiSelectFieldProps = {
  id: string;
  label: string;
  values: string[];
  options: CatalogItem[];
  onChange: (values: string[]) => void;
  language?: CatalogLanguage;
  placeholder?: string;
};

export function MultiSelectField({
  id,
  label,
  values,
  options,
  onChange,
  language = 'vi',
  placeholder = 'Tất cả',
}: MultiSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => options.filter((option) => values.includes(option.id)),
    [options, values],
  );
  const selectedNames = selected.map((option) =>
    getCatalogDisplayName(option, language),
  );
  const summary = selected.length
    ? selected.length > 2
      ? `${selected.length} ${language === 'en' ? 'selected' : 'đã chọn'}`
      : selectedNames.join(', ')
    : placeholder;
  const labelId = `${id}-label`;

  const toggleValue = (value: string) => {
    onChange(
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  return (
    <div className="relative min-w-0">
      <span id={labelId} className="label">
        {label}
      </span>
      <details
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary
          className="field multi-select-trigger flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
          aria-labelledby={labelId}
        >
          <span className="min-w-0 truncate">{summary}</span>
          <ChevronDown
            className="shrink-0 transition-transform group-open:rotate-180"
            size={17}
            aria-hidden="true"
          />
        </summary>
        <div
          role="listbox"
          aria-label={label}
          aria-multiselectable="true"
          className="absolute left-0 top-full z-30 mt-1 max-h-64 min-w-full overflow-y-auto rounded-xl border border-black/10 bg-white p-1.5 shadow-xl dark:border-white/15 dark:bg-[#343746]"
        >
          <button
            type="button"
            className="mb-1 flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-gray-500 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
            onClick={() => onChange([])}
            disabled={!values.length}
          >
            <span>{language === 'en' ? 'All' : 'Tất cả'}</span>
            {!values.length && <Check size={15} aria-hidden="true" />}
          </button>
          {options.length ? (
            options.map((option) => {
              const optionLabel = getCatalogDisplayName(option, language);
              const checked = values.includes(option.id);
              return (
                <label
                  key={option.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <input
                    type="checkbox"
                    value={option.id}
                    checked={checked}
                    aria-label={`${label}: ${optionLabel}`}
                    onChange={() => toggleValue(option.id)}
                    className="size-4 accent-violet-600"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {optionLabel}
                  </span>
                  {checked && <Check size={15} aria-hidden="true" />}
                </label>
              );
            })
          ) : (
            <p className="px-2.5 py-2 text-sm text-gray-500 dark:text-gray-400">
              {language === 'en' ? 'No options' : 'Chưa có lựa chọn'}
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
