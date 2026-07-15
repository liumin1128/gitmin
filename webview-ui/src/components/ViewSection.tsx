import type { MouseEvent, ReactNode } from 'react';

interface Props {
  id: string;
  title: string;
  count?: number;
  visible: boolean;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function ViewSection({
  id,
  title,
  count,
  visible,
  collapsed,
  onCollapsedChange,
  actions,
  children,
}: Props) {
  if (!visible) return null;

  const contentId = `${id}-section-content`;
  const actionLabel = `${collapsed ? 'Expand' : 'Collapse'}${title}`;
  const stopPropagation = (event: MouseEvent) => event.stopPropagation();

  return (
    <section className={`view-section${collapsed ? ' is-collapsed' : ''}`} data-view-id={id}>
      <div className="view-section-header">
        <button
          type="button"
          className="view-section-toggle"
          aria-label={actionLabel}
          title={actionLabel}
          aria-expanded={!collapsed}
          aria-controls={contentId}
          onClick={() => onCollapsedChange(!collapsed)}
        >
          <span className="view-section-chevron" aria-hidden="true">›</span>
          <span className="view-section-title">{title}</span>
          {count !== undefined && count > 0 && (
            <span className="view-section-count">{count}</span>
          )}
        </button>
        {actions && (
          <div className="view-section-actions" onClick={stopPropagation}>
            {actions}
          </div>
        )}
      </div>
      {!collapsed && (
        <div id={contentId} className="view-section-content">
          {children}
        </div>
      )}
    </section>
  );
}
