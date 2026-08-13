/**
 * simple-git wrapper: only exposes business-needed methods
 * All return values use domain types from shared/domain
 */
import { simpleGit, type SimpleGit } from 'simple-git';
import type { Commit, CommitDetails, CommitFilters, FileChange } from '../../shared/domain';
import {
  LOG_FORMAT,
  parseLogOutput,
  parseNameStatus,
  parseNumstat,
  mergeFileChanges,
} from '../utils/commitParser';
import {
  COMMIT_DETAILS_FORMAT,
  parseCommitDetailsOutput,
} from '../utils/commitDetailsParser';
import { COMMIT_PAGE_SIZE } from '../../shared/commitPagination';

export class GitService {
  private readonly git: SimpleGit;

  constructor(rootPath: string) {
    this.git = simpleGit(rootPath);
  }

  /** Fetch recent commits, optionally filtered (excluding search) */
  async getLog(
    opts: { offset?: number; limit?: number; filters?: CommitFilters } = {}
  ): Promise<Commit[]> {
    const { offset, limit } = normalizeLogPagination(opts.limit ?? 100, opts.offset ?? 0);
    const args = buildLogArgs(limit, offset, opts.filters);
    const [output, unpushedHashes] = await Promise.all([
      this.git.raw(args),
      this.getUnpushedCommitHashes(opts.filters?.branch),
    ]);
    return parseLogOutput(output).map((commit) => ({
      ...commit,
      isUnpushed: unpushedHashes.has(commit.hash),
    }));
  }

  private async getUnpushedCommitHashes(branch?: string): Promise<Set<string>> {
    const selectedBranch = branch?.trim();
    const head = selectedBranch && selectedBranch !== '__all__' ? selectedBranch : 'HEAD';

    try {
      const output = await this.git.raw([
        'rev-list',
        `${head}@{upstream}..${head}`,
      ]);
      return new Set(output.split('\n').map((hash) => hash.trim()).filter(Boolean));
    } catch {
      // Detached HEADs and unpublished branches have no upstream to compare against.
      return new Set();
    }
  }

  async getCommitDetails(hashes: string[]): Promise<CommitDetails[]> {
    if (hashes.length === 0) return [];
    const output = await this.git.raw([
      'log',
      '--no-walk=unsorted',
      `--pretty=format:${COMMIT_DETAILS_FORMAT}`,
      ...hashes,
    ]);
    return parseCommitDetailsOutput(output);
  }

  /** Cumulative diff file list (with A/M/D/R status + line counts) */
  async getDiffSummary(base: string, head: string): Promise<FileChange[]> {
    const range = `${base}..${head}`;
    const [nameStatusOut, numstatOut] = await Promise.all([
      this.git.raw(['diff', '--name-status', range]),
      this.git.raw(['diff', '--numstat', range]),
    ]);
    return mergeFileChanges(parseNameStatus(nameStatusOut), parseNumstat(numstatOut));
  }

  /** Local + remote branch names (deduped, no HEAD alias) */
  async getBranches(): Promise<string[]> {
    const summary = await this.git.branch(['-a']);
    const set = new Set<string>();
    for (const raw of summary.all) {
      if (!raw || raw.includes(' -> ')) continue;
      set.add(raw);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** Extract author list from the last ~500 log entries (deduped, alpha sorted) */
  async getAuthors(sampleSize: number = 500): Promise<string[]> {
    const output = await this.git.raw([
      'log',
      '--all',
      '--pretty=format:%an',
      '-n',
      String(sampleSize),
    ]);
    const set = new Set<string>();
    for (const line of output.split('\n')) {
      const name = line.trim();
      if (name) set.add(name);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }
}

/**
 * Build git log arguments
 * - search is not handled here (server-side pure function handles it)
 */
export function buildLogArgs(
  limit: number,
  offset: number = 0,
  filters?: CommitFilters
): string[] {
  const pagination = normalizeLogPagination(limit, offset);
  const args = [
    'log',
    `--pretty=format:${LOG_FORMAT}`,
    '--decorate=short',
    '--skip',
    String(pagination.offset),
    '-n',
    String(pagination.limit),
  ];
  if (!filters) return args;

  if (filters.branch === '__all__') {
    args.push('--all');
  } else if (filters.branch && filters.branch.trim()) {
    args.push(filters.branch.trim());
  }

  if (filters.author && filters.author.trim()) {
    args.push(`--author=${filters.author.trim()}`);
  }
  if (filters.dateAfter) {
    args.push(`--after=${filters.dateAfter}`);
  }
  if (filters.dateBefore) {
    args.push(`--before=${filters.dateBefore}`);
  }
  return args;
}

export function normalizeLogPagination(
  limit: number,
  offset: number = 0
): { limit: number; offset: number } {
  return {
    limit: Number.isFinite(limit) && limit > 0
      ? Math.max(1, Math.floor(limit))
      : COMMIT_PAGE_SIZE,
    offset: Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : 0,
  };
}
