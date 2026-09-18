import { formatCompactVnd, formatVnd } from '../../lib/domain';

type AmountProps = {
  value: number;
  variant?: 'full' | 'compact';
  className?: string;
  label?: string;
};

/**
 * Shared money presentation: compact values for scanning, full values for
 * decisions and assistive technology.
 */
export function Amount({ value, variant = 'full', className = '', label }: AmountProps) {
  const fullValue = formatVnd(value);
  return (
    <span
      className={className}
      title={fullValue}
      aria-label={label ? `${label}: ${fullValue}` : fullValue}
    >
      {variant === 'compact' ? formatCompactVnd(value) : fullValue}
    </span>
  );
}
