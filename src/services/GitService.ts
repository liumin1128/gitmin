/**
 * simple-git 封装：只暴露业务需要的方法
 * 全部返回 shared/domain 中定义的领域类型
 */
import { simpleGit, type SimpleGit } from 'simple-git';
import type { Commit, CommitFilters, FileChange } from '../../shared/domain';
import {
  LOG_FORMAT,
  parseLogOutput,
  parseNameStatus,
  parseNumstat,
  mergeFileChanges,
} from '../utils/commitParser';

export class GitService {
  private readonly git: SimpleGit;

  constructor(rootPath: string) {
    this.git = simpleGit(rootPath);
  }

  /** 拉取最近 limit 条 commit，可按 filter 缩小范围（不含 search） */
  async getLog(opts: { limit?: number; filters?: CommitFilters } = {}): Promise<Commit[]> {
    const limit = opts.limit ?? 100;
    const args = buildLogArgs(limit, opts.filters);
    const output = await this.git.raw(args);
    return parseLogOutput(output);
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
function buildLogArgs(limit: number, filters?: CommitFilters): string[] {
  const args = ['log', `--pretty=format:${LOG_FORMAT}`, '-n', String(limit)];
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
