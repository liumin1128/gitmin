/**
 * Column visibility settings: more options button + VS Code-style checked menu
 * Message is always visible so not included in config items
 */
import type { ColumnFlags } from './CommitList';
import { t, type TranslationKey } from '../../../shared/i18n';
import { CheckedMenuItem } from './CheckedMenuItem';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  columns: ColumnFlags;
  onChange: (next: ColumnFlags) => void;
}

const ITEMS: Array<{ key: keyof ColumnFlags; labelKey: TranslationKey }> = [
  { key: 'graph', labelKey: 'column.graph' },
  { key: 'hash', labelKey: 'column.hash' },
  { key: 'author', labelKey: 'column.author' },
  { key: 'time', labelKey: 'column.time' },
  { key: 'tags', labelKey: 'column.tags' },
];

export function ColumnsMenu({ columns, onChange }: Props) {
  return (
    <FilterDropdown
      label={<span className="codicon codicon-more" aria-hidden="true" />}
      title={t('column.display')}
      hideCaret
      className="columns-menu"
    >
      {() => (
        <div className="filter-list" role="menu">
          {ITEMS.map(({ key, labelKey }) => (
            <CheckedMenuItem
              key={key}
              checked={columns[key]}
              onChange={(checked) => onChange({ ...columns, [key]: checked })}
            >
              {t(labelKey)}
            </CheckedMenuItem>
          ))}
        </div>
      )}
    </FilterDropdown>
  );
}
