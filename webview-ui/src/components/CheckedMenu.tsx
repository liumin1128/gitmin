import type { ReactNode } from 'react';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

export interface CheckedMenuOption<TKey extends string> {
  key: TKey;
  label: ReactNode;
  checked: boolean;
}

interface Props<TKey extends string> {
  title: string;
  options: readonly CheckedMenuOption<TKey>[];
  onChange: (key: TKey, checked: boolean) => void;
  className?: string;
}

export function CheckedMenu<TKey extends string>({
  title,
  options,
  onChange,
  className,
}: Props<TKey>) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title={title}
      hideCaret
      className={`checked-menu${className ? ` ${className}` : ''}`}
    >
      {() => (
        <div className="filter-list" role="menu">
          {options.map((option) => (
            <CheckedMenuItem
              key={option.key}
              checked={option.checked}
              onChange={(checked) => onChange(option.key, checked)}
            >
              {option.label}
            </CheckedMenuItem>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
