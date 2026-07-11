/**
 * 列可见性设置：更多操作按钮 + VS Code 风格的选中菜单
 * message 恒可见故不在配置项中
 */
import type { ColumnFlags } from './CommitList';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  columns: ColumnFlags;
  onChange: (next: ColumnFlags) => void;
}

const ITEMS: Array<{ key: keyof ColumnFlags; label: string }> = [
  { key: 'graph', label: '分支图' },
  { key: 'hash', label: 'Hash' },
  { key: 'author', label: '作者' },
  { key: 'time', label: '时间' },
  { key: 'tags', label: '标签' },
];

export function ColumnsMenu({ columns, onChange }: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title="显示列"
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
