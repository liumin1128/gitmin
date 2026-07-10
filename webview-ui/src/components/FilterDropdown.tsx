/**
 * 通用下拉：按钮 + 展开面板
 * - 内部管理 open 状态
 * - 点击按钮切换、点击外部/ESC 关闭
 * - 面板内容由 children 决定（选项列表 / 日期表单 / 路径输入）
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  label: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  children: (close: () => void) => ReactNode;
}

export function FilterDropdown({ label, active, disabled, title, children }: Props) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);

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

  // 打开时若面板右溢出视口，切换为右对齐；关闭时复位
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
    <div className="filter-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`filter-dropdown-btn${active ? ' is-active' : ''}${open ? ' is-open' : ''}`}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={title ?? label}
      >
        <span>{label}</span>
        <span className="filter-dropdown-caret">▾</span>
      </button>
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
