/**
 * Generic dropdown: button + expandable panel
 * - Manages open state internally
 * - Toggle on button click, close on outside click / ESC
 * - Panel content determined by children (option list / date form / path input)
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { t } from '../../../shared/i18n';

interface Props {
  label: ReactNode;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  hideCaret?: boolean;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onClear?: () => void;
  clearLabel?: string;
  children: (close: () => void) => ReactNode;
}

export function FilterDropdown({
  label,
  active,
  disabled,
  title,
  hideCaret,
  className,
  open: controlledOpen,
  onOpenChange,
  onClear,
  clearLabel,
  children,
}: Props) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback((next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  }, [controlledOpen, onOpenChange]);
  const close = useCallback(() => setOpen(false), [setOpen]);
  const buttonTitle = title ?? (typeof label === 'string' ? label : undefined);
  const resolvedClearLabel = clearLabel ?? t('filter.clear');

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) close();
    };
    const onEsc = (e: KeyboardEvent) => e.key === 'Escape' && close();
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', onDocClick);
      window.addEventListener('keydown', onEsc);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open, close]);

  // If panel overflows viewport on the right, switch to right-aligned; reset on close
  useLayoutEffect(() => {
    if (!open) {
      setAlignRight(false);
      return;
    }
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    if (rect.right > window.innerWidth - 4) setAlignRight(true);
  }, [open]);

  return (
    <div className={`filter-dropdown${className ? ' ' + className : ''}`} ref={rootRef}>
      <button
        type="button"
        className={`filter-dropdown-btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        title={buttonTitle}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="filter-dropdown-label">{label}</span>
        {!hideCaret && <span className="filter-dropdown-caret">▾</span>}
      </button>
      {active && onClear && (
        <button
          type="button"
          className="filter-dropdown-clear"
          aria-label={resolvedClearLabel}
          title={resolvedClearLabel}
          onClick={() => {
            close();
            onClear();
          }}
        >
          <span className="codicon codicon-close" aria-hidden="true" />
        </button>
      )}
      {open && (
        <div
          ref={panelRef}
          className={`filter-dropdown-panel${alignRight ? ' align-right' : ''}`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}
