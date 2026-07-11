import type { ReactNode } from 'react';

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}

export function CheckedMenuItem({ checked, onChange, children }: Props) {
  return (
    <button
      type="button"
      className="checked-menu-item"
      role="menuitemcheckbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="checked-menu-indicator" aria-hidden="true">
        {checked ? '✓' : ''}
      </span>
      <span className="checked-menu-label">{children}</span>
    </button>
  );
}
