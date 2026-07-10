/**
 * 列可见性设置：齿轮按钮 + 弹出复选面板
 * message 恒可见故不在配置项中
 */
import type { ColumnFlags } from './CommitList';
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
];

export function ColumnsMenu({ columns, onChange }: Props) {
  return (
    <FilterDropdown label="⚙" title="显示列" hideCaret className="columns-menu">
      {() => (
        <div className="filter-list">
          {ITEMS.map(({ key, label }) => (
            <label key={key} className="filter-check">
              <input
                type="checkbox"
                checked={columns[key]}
                onChange={(e) => onChange({ ...columns, [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
