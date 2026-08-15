/**
 * WebStorm-style commit filter bar:
 *  [Search text or hash        .*  Cc]  [Branch▼] [Author▼] [Date▼] [Path▼]
 *
 * Component responsibility: controlled display + user interaction; search input has internal debounce
 * No git calls, business logic triggered via onChange in parent component
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CommitFilters, FilterOptions } from '../../../shared/domain';
import { isValidSearch } from '../../../shared/commitFilter';
import { t } from '../../../shared/i18n';
import { useDebounce } from '../hooks/useDebounce';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  filters: CommitFilters;
  options: FilterOptions;
  onChange: (next: CommitFilters) => void;
  onRefresh: () => void;
  actions?: ReactNode;
}

const BRANCH_ALL = '__all__';

export function FilterBar({
  filters,
  options,
  onChange,
  onRefresh,
  actions,
}: Props) {
  // Search text debounce: update draft immediately, commit after 250ms
  const [searchDraft, setSearchDraft] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchDraft, 250);

  useEffect(() => {
    setSearchDraft(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    if ((filters.search ?? '') === debouncedSearch) return;
    onChange({ ...filters, search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const searchValid = useMemo(
    () => isValidSearch(searchDraft, !!filters.searchRegex),
    [searchDraft, filters.searchRegex]
  );

  const patch = (p: Partial<CommitFilters>) => onChange({ ...filters, ...p });

  return (
    <div className="filter-bar">
      {/* Search box */}
      <div className={`filter-search${!searchValid ? ' is-invalid' : ''}`}>
        <span className="filter-search-icon codicon codicon-search" aria-hidden="true" />
        <input
          className="filter-search-input"
          type="text"
          value={searchDraft}
          placeholder={t('filter.searchPlaceholder')}
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <button
          type="button"
          className={`filter-toggle${filters.searchRegex ? ' is-active' : ''}`}
          title={t('filter.regex')}
          onClick={() => patch({ searchRegex: !filters.searchRegex })}
        >
          .*
        </button>
        <button
          type="button"
          className={`filter-toggle${filters.searchCaseSensitive ? ' is-active' : ''}`}
          title={t('filter.caseSensitive')}
          onClick={() => patch({ searchCaseSensitive: !filters.searchCaseSensitive })}
        >
          Cc
        </button>
      </div>

      <div className="filter-bar-controls">
        <div className="filter-options">
          <FilterDropdown
            label={t('filter.branch', { value: branchLabel(filters.branch) })}
            active={!!filters.branch}
            disabled={options.branches.length === 0}
            onClear={() => patch({ branch: undefined })}
            clearLabel={t('filter.clearBranch')}
          >
            {(close) => (
              <BranchPanel
                branches={options.branches}
                value={filters.branch}
                onSelect={(v) => {
                  patch({ branch: v });
                  close();
                }}
              />
            )}
          </FilterDropdown>

          <FilterDropdown
            label={t('filter.author', { value: filters.author || t('common.all') })}
            active={!!filters.author}
            disabled={options.authors.length === 0}
            onClear={() => patch({ author: undefined })}
            clearLabel={t('filter.clearAuthor')}
          >
            {(close) => (
              <AuthorPanel
                authors={options.authors}
                value={filters.author}
                onSelect={(v) => {
                  patch({ author: v });
                  close();
                }}
              />
            )}
          </FilterDropdown>

          <FilterDropdown
            label={t('filter.date', {
              value: dateLabel(filters.dateAfter, filters.dateBefore),
            })}
            active={!!(filters.dateAfter || filters.dateBefore)}
            onClear={() => patch({ dateAfter: undefined, dateBefore: undefined })}
            clearLabel={t('filter.clearDate')}
          >
            {(close) => (
              <DatePanel
                after={filters.dateAfter ?? ''}
                before={filters.dateBefore ?? ''}
                onApply={(after, before) => {
                  patch({ dateAfter: after || undefined, dateBefore: before || undefined });
                  close();
                }}
              />
            )}
          </FilterDropdown>
        </div>

        <div className="filter-actions">
          <button
            type="button"
            className="toolbar-icon-button"
            onClick={onRefresh}
            title={t('filter.refreshCommits')}
            aria-label={t('filter.refreshCommits')}
          >
            <span className="codicon codicon-refresh" aria-hidden="true" />
          </button>
          {actions}
        </div>
      </div>
    </div>
  );
}

// ===== Sub-panels =====

interface BranchPanelProps {
  branches: string[];
  value?: string;
  onSelect: (branch: string | undefined) => void;
}
function BranchPanel({ branches, value, onSelect }: BranchPanelProps) {
  return (
    <div className="filter-list">
      <button
        type="button"
        className={`filter-list-item${!value ? ' is-selected' : ''}`}
        onClick={() => onSelect(undefined)}
      >
        {t('filter.currentBranch')}
      </button>
      <button
        type="button"
        className={`filter-list-item${value === BRANCH_ALL ? ' is-selected' : ''}`}
        onClick={() => onSelect(BRANCH_ALL)}
      >
        {t('filter.allBranches')}
      </button>
      <div className="filter-list-sep" />
      {branches.map((b) => (
        <button
          key={b}
          type="button"
          className={`filter-list-item${value === b ? ' is-selected' : ''}`}
          onClick={() => onSelect(b)}
        >
          {b}
        </button>
      ))}
    </div>
  );
}

interface AuthorPanelProps {
  authors: string[];
  value?: string;
  onSelect: (author: string | undefined) => void;
}
function AuthorPanel({ authors, value, onSelect }: AuthorPanelProps) {
  return (
    <div className="filter-list">
      <button
        type="button"
        className={`filter-list-item${!value ? ' is-selected' : ''}`}
        onClick={() => onSelect(undefined)}
      >
        {t('common.all')}
      </button>
      <div className="filter-list-sep" />
      {authors.map((a) => (
        <button
          key={a}
          type="button"
          className={`filter-list-item${value === a ? ' is-selected' : ''}`}
          onClick={() => onSelect(a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

interface DatePanelProps {
  after: string;
  before: string;
  onApply: (after: string, before: string) => void;
}
function DatePanel({ after, before, onApply }: DatePanelProps) {
  const [a, setA] = useState(after);
  const [b, setB] = useState(before);
  return (
    <div className="filter-form">
      <label className="filter-form-row">
        <span>{t('filter.from')}</span>
        <input type="date" value={a} onChange={(e) => setA(e.target.value)} />
      </label>
      <label className="filter-form-row">
        <span>{t('filter.to')}</span>
        <input type="date" value={b} onChange={(e) => setB(e.target.value)} />
      </label>
      <div className="filter-form-actions">
        <button type="button" className="btn-secondary" onClick={() => onApply('', '')}>
          {t('common.clear')}
        </button>
        <button type="button" className="btn" onClick={() => onApply(a, b)}>
          {t('common.apply')}
        </button>
      </div>
    </div>
  );
}

// ===== Display helpers =====

function branchLabel(v?: string): string {
  if (!v) return 'HEAD';
  if (v === BRANCH_ALL) return t('common.all');
  return v;
}

function dateLabel(after?: string, before?: string): string {
  if (!after && !before) return t('common.all');
  if (after && before) return `${after} ~ ${before}`;
  if (after) return `≥ ${after}`;
  return `≤ ${before}`;
}
