/**
 * Commit list container: only handles rendering + scroll-to-bottom event reporting
 * Multi-select state provided by parent via useMultiSelect
 * Graph layout computed once by layoutCommits, grid-template-columns dynamically generated from column visibility
 */
import { useEffect, useMemo, useRef, type CSSProperties, type MouseEvent } from 'react';
import type { Commit } from '../../../shared/domain';
import { isNearCommitListBottom } from '../../../shared/commitPagination';
import { layoutCommits } from '../utils/commitGraph';
import { measurePx, shortHash, relativeTime, tagListText } from '../utils/formatters';
import { CommitItem } from './CommitItem';

/** Column visibility; message always visible so not listed */
export interface ColumnFlags {
  graph: boolean;
  hash: boolean;
  author: boolean;
  time: boolean;
  tags: boolean;
}

export const DEFAULT_COLUMNS: ColumnFlags = {
  graph: true,
  hash: false,
  author: true,
  time: true,
  tags: false,
};

export function shouldLoadMore(
  hasMore: boolean,
  loadingMore: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number
): boolean {
  return hasMore && !loadingMore && isNearCommitListBottom(scrollTop, clientHeight, scrollHeight);
}

export function runLoadMoreCheck(
  hasMore: boolean,
  loadingMore: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  onLoadMore: () => void
): boolean {
  if (!shouldLoadMore(hasMore, loadingMore, scrollTop, clientHeight, scrollHeight)) {
    return false;
  }

  onLoadMore();
  return true;
}

export function runAutomaticLoadMoreCheck(
  automaticLoadEnabled: boolean,
  hasMore: boolean,
  loadingMore: boolean,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  onLoadMore: () => void
): boolean {
  return automaticLoadEnabled && runLoadMoreCheck(
    hasMore,
    loadingMore,
    scrollTop,
    clientHeight,
    scrollHeight,
    onLoadMore
  );
}

interface Props {
  commits: Commit[];
  columns: ColumnFlags;
  isSelected: (hash: string) => boolean;
  onItemClick: (hash: string, event: MouseEvent) => void;
  onItemContextMenu: (hash: string, event: MouseEvent) => void;
  hasMore: boolean;
  preserveUnresolvedParents: boolean;
  loadingMore: boolean;
  automaticLoadEnabled: boolean;
  onLoadMore: () => void;
}

export function CommitList({
  commits,
  columns,
  isSelected,
  onItemClick,
  onItemContextMenu,
  hasMore,
  preserveUnresolvedParents,
  loadingMore,
  automaticLoadEnabled,
  onLoadMore,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const { rows, maxLanes } = useMemo(
    () => layoutCommits(commits, { preserveUnresolvedParents }),
    [commits, preserveUnresolvedParents]
  );

  const LANE_W = 16;
  const PAD = 4;

  const colWidths = useMemo(() => {
    let hashW = 0;
    let authorW = 0;
    let timeW = 0;
    let tagsW = 0;

    for (const c of commits) {
      if (columns.hash) {
        hashW = Math.max(hashW, measurePx(shortHash(c.hash), "11.7px monospace"));
      }
      if (columns.author) {
        authorW = Math.max(authorW, measurePx(c.author, '11.7px -apple-system, sans-serif'));
      }
      if (columns.time) {
        timeW = Math.max(timeW, measurePx(relativeTime(c.date), '11.7px -apple-system, sans-serif'));
      }
      if (columns.tags && c.refs.length > 0) {
        tagsW = Math.max(tagsW, measurePx(tagListText(c.refs), '10px -apple-system, sans-serif'));
      }
    }

    return { hashW, authorW, timeW, tagsW };
  }, [commits, columns]);

  useEffect(() => {
    const scrollContainer = listRef.current?.closest<HTMLElement>('.workbench-panel-content');
    if (!scrollContainer) return;

    const scrollMetrics = () => [
      scrollContainer.scrollTop,
      scrollContainer.clientHeight,
      scrollContainer.scrollHeight,
    ] as const;
    const checkForMore = () => {
      const [scrollTop, clientHeight, scrollHeight] = scrollMetrics();
      return runAutomaticLoadMoreCheck(
        automaticLoadEnabled,
        hasMore,
        loadingMore,
        scrollTop,
        clientHeight,
        scrollHeight,
        onLoadMore
      );
    };
    const handleScroll = () => {
      const [scrollTop, clientHeight, scrollHeight] = scrollMetrics();
      return runLoadMoreCheck(
        hasMore,
        loadingMore,
        scrollTop,
        clientHeight,
        scrollHeight,
        onLoadMore
      );
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    checkForMore();

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? undefined
      : new ResizeObserver(checkForMore);
    resizeObserver?.observe(scrollContainer);

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      resizeObserver?.disconnect();
    };
  }, [automaticLoadEnabled, columns, commits, hasMore, loadingMore, onLoadMore]);

  if (commits.length === 0) {
    return <div className="empty-hint">No commits</div>;
  }

  const gridTemplate = [
    columns.graph ? `${maxLanes * LANE_W}px` : null,
    '1fr',
    columns.author ? `${Math.ceil(colWidths.authorW) + PAD}px` : null,
    columns.hash ? `${Math.ceil(colWidths.hashW) + PAD}px` : null,
    columns.time ? `${Math.ceil(colWidths.timeW) + PAD}px` : null,
    columns.tags ? `${Math.ceil(colWidths.tagsW) + PAD * 2}px` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const style = { '--commit-cols': gridTemplate } as CSSProperties;

  return (
    <div ref={listRef} className="commit-list" style={style}>
      {commits.map((c, i) => (
        <CommitItem
          key={c.hash}
          commit={c}
          columns={columns}
          graphRow={rows[i]!}
          maxLanes={maxLanes}
          selected={isSelected(c.hash)}
          onClick={onItemClick}
          onContextMenu={onItemContextMenu}
        />
      ))}
    </div>
  );
}
