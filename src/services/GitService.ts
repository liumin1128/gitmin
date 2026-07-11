/**
 * simple-git 封装：只暴露业务需要的方法
 * 全部返回 shared/domain 中定义的领域类型
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

  /** 拉取最近 limit 条 commit，可按 filter 缩小范围（不含 search） */
  async getLog(
    opts: { offset?: number; limit?: number; filters?: CommitFilters } = {}
  ): Promise<Commit[]> {
    const { offset, limit } = normalizeLogPagination(opts.limit ?? 100, opts.offset ?? 0);
    const args = buildLogArgs(limit, offset, opts.filters);
    const output = await this.git.raw(args);
    return parseLogOutput(output);
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

  /** 累积 diff 的变更文件列表（含 A/M/D/R 状态 + 增删行数） */
  async getDiffSummary(base: string, head: string): Promise<FileChange[]> {
    const range = `${base}..${head}`;
    const [nameStatusOut, numstatOut] = await Promise.all([
      this.git.raw(['diff', '--name-status', range]),
      this.git.raw(['diff', '--numstat', range]),
    ]);
    return mergeFileChanges(parseNameStatus(nameStatusOut), parseNumstat(numstatOut));
  }

  /** 本地 + 远程分支名（去重、去掉 HEAD 指向别名） */
  async getBranches(): Promise<string[]> {
    const summary = await this.git.branch(['-a']);
    const set = new Set<string>();
    for (const raw of summary.all) {
      if (!raw || raw.includes(' -> ')) continue;
      set.add(raw);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }

  /** 从近 500 条 log 中提取作者列表（去重、按字母排序） */
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
 * 组装 git log 参数
 * - search 不在这里处理（服务端后置纯函数负责）
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
