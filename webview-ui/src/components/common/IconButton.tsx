/**
 * Shared VS Code-style toolbar icon button (pure UI).
 * Renders a stable attribute order so static-markup checks stay predictable.
 */
interface Props {
  icon: string;
  title: string;
  disabled?: boolean;
  spin?: boolean;
  className?: string;
  onClick: () => void;
}

export function IconButton({
  icon,
  title,
  disabled = false,
  spin = false,
  className,
  onClick,
}: Props) {
  return (
    <button
      type="button"
      className={`toolbar-icon-button${className ? ` ${className}` : ''}`}
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
    >
      <span
        className={`codicon codicon-${icon}${spin ? ' codicon-modifier-spin' : ''}`}
        aria-hidden="true"
      />
    </button>
  );
}
