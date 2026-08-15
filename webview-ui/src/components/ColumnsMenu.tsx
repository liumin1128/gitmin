/**
 * Column visibility settings: more options button + VS Code-style checked menu
 * Message is always visible so not included in config items
 */
import type { ColumnFlags } from './CommitList';
import { t, type TranslationKey } from '../../../shared/i18n';
import { CheckedMenu } from './CheckedMenu';

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
  const options = ITEMS.map(({ key, labelKey }) => ({
    key,
    label: t(labelKey),
    checked: columns[key],
  }));

  return (
    <CheckedMenu
      title={t('column.display')}
      className="columns-menu"
      options={options}
      onChange={(key, checked) => onChange({ ...columns, [key]: checked })}
    />
  );
}
