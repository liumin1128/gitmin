/**
 * Column visibility settings: more options button + VS Code-style checked menu
 * Message is always visible so not included in config items
 */
import type { ColumnFlags } from './CommitList';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  columns: ColumnFlags;
  onChange: (next: ColumnFlags) => void;
}

const ITEMS: Array<{ key: keyof ColumnFlags; label: string }> = [
  { key: 'graph', label: 'Graph' },
  { key: 'hash', label: 'Hash' },
  { key: 'author', label: 'Author' },
  { key: 'time', label: 'Time' },
  { key: 'tags', label: 'Tags' },
];

export function ColumnsMenu({ columns, onChange }: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title="Display columns"
      hideCaret
      className="columns-menu"
    >
      {() => (
        <div className="filter-list" role="menu">
          {ITEMS.map(({ key, label }) => (
            <CheckedMenuItem
              key={key}
              checked={columns[key]}
              onChange={(checked) => onChange({ ...columns, [key]: checked })}
            >
              {label}
            </CheckedMenuItem>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
