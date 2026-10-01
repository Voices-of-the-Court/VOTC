import React from 'react';
import './SegmentedSwitch.scss';

export interface SegmentedOption<T extends string | number> {
  /** The value this option represents. */
  value: T;
  /** Visible label for the segment. */
  label: React.ReactNode;
  /** Optional tooltip / title for the segment button. */
  title?: string;
  /** Optional per-segment disable. */
  disabled?: boolean;
}

interface SegmentedSwitchProps<T extends string | number> {
  /** Available segments. */
  options: SegmentedOption<T>[];
  /** Currently selected value. */
  value: T;
  /** Called when the user picks a segment. */
  onChange: (value: T) => void;
  /** Accessible label for the group. */
  ariaLabel?: string;
  /** Disable the whole switch. */
  disabled?: boolean;
  /** Visual size. 'sm' is compact */
  size?: 'sm' | 'md';
  /** Stretch to fill the container width. Defaults to false (inline). */
  fullWidth?: boolean;
  className?: string;
}

/**
 * SegmentedSwitch — a compact, mutually-exclusive toggle between a small fixed
 * set of options (e.g. 5m / 1h).
 * Generic over the value type so callers keep type safety without `as any`.
 */
function SegmentedSwitch<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  disabled = false,
  size = 'md',
  fullWidth = false,
  className,
}: SegmentedSwitchProps<T>): React.ReactElement {
  const classes = [
    'segmented-switch',
    `segmented-switch--${size}`,
    fullWidth ? 'segmented-switch--full' : '',
    disabled ? 'segmented-switch--disabled' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      role="group"
      aria-label={ariaLabel}
      data-disabled={disabled || undefined}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        const isDisabled = disabled || !!opt.disabled;
        return (
          <button
            key={String(opt.value)}
            type="button"
            className={[
              'segmented-switch__option',
              isActive ? 'segmented-switch__option--active' : '',
              isDisabled ? 'segmented-switch__option--disabled' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            title={opt.title}
            aria-pressed={isActive}
            disabled={isDisabled}
            onClick={() => !isDisabled && onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedSwitch;
