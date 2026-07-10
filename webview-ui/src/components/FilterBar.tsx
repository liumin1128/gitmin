/**
 * WebStorm 风格 commit 过滤栏：
 *  [🔍 文本或哈希          .*  Cc]  [分支▼] [用户▼] [日期▼] [路径▼]
 *
 * 组件职责：受控展示 + 用户交互；搜索输入内部 debounce
 * 不含任何 git 调用，业务在父组件通过 onChange 触发
 */
import { useEffect, useMemo, useState } from 'react';
import type { CommitFilters, FilterOptions } from '../../../shared/domain';
import { isValidSearch } from '../../../shared/commitFilter';
import { useDebounce } from '../hooks/useDebounce';
import { FilterDropdown } from './FilterDropdown';

interface Props {
  filters: CommitFilters;
  options: FilterOptions;
  onChange: (next: CommitFilters) => void;
}

const BRANCH_ALL = '__all__';

export function FilterBar({ filters, options, onChange }: Props) {
  // 搜索文本 debounce：输入即刻更新 draft，250ms 稳定后提交
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
      {/* 搜索框 */}
      <div className={`filter-search${!searchValid ? ' is-invalid' : ''}`}>
        <span className="filter-search-icon">🔍</span>
        <input
          className="filter-search-input"
          type="text"
          value={searchDraft}
          placeholder="文本或哈希"
          onChange={(e) => setSearchDraft(e.target.value)}
        />
        <button
          type="button"
          className={`filter-toggle${filters.searchRegex ? ' is-active' : ''}`}
          title="正则表达式"
          onClick={() => patch({ searchRegex: !filters.searchRegex })}
        >
          .*
        </button>
        <button
          type="button"
          className={`filter-toggle${filters.searchCaseSensitive ? ' is-active' : ''}`}
          title="大小写敏感"
          onClick={() => patch({ searchCaseSensitive: !filters.searchCaseSensitive })}
        >
          Cc
        </button>
      </div>

      {/* 分支 */}
      <FilterDropdown
        label={`分支: ${branchLabel(filters.branch)}`}
        active={!!filters.branch}
        disabled={options.branches.length === 0}
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

      {/* 用户 */}
      <FilterDropdown
        label={`用户: ${filters.author || '全部'}`}
        active={!!filters.author}
        disabled={options.authors.length === 0}
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

      {/* 日期 */}
      <FilterDropdown
        label={`日期: ${dateLabel(filters.dateAfter, filters.dateBefore)}`}
        active={!!(filters.dateAfter || filters.dateBefore)}
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
  );
}

// ===== 子面板 =====

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
        HEAD（当前分支）
      </button>
      <button
        type="button"
        className={`filter-list-item${value === BRANCH_ALL ? ' is-selected' : ''}`}
        onClick={() => onSelect(BRANCH_ALL)}
      >
        所有分支
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
        全部
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
        <span>从</span>
        <input type="date" value={a} onChange={(e) => setA(e.target.value)} />
      </label>
      <label className="filter-form-row">
        <span>到</span>
        <input type="date" value={b} onChange={(e) => setB(e.target.value)} />
      </label>
      <div className="filter-form-actions">
        <button type="button" className="btn-secondary" onClick={() => onApply('', '')}>
          清除
        </button>
        <button type="button" className="btn" onClick={() => onApply(a, b)}>
          应用
        </button>
      </div>
    </div>
  );
}

// ===== 展示辅助 =====

function branchLabel(v?: string): string {
  if (!v) return 'HEAD';
  if (v === BRANCH_ALL) return '所有';
  return v;
}

function dateLabel(after?: string, before?: string): string {
  if (!after && !before) return '全部';
  if (after && before) return `${after} ~ ${before}`;
  if (after) return `≥ ${after}`;
  return `≤ ${before}`;
}
