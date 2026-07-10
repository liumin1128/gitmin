/**
 * simple-git 封装：只暴露业务需要的方法
 * 全部返回 shared/domain 中定义的领域类型
 */
import { simpleGit, type SimpleGit } from 'simple-git';
import type { Commit, FileChange } from '../../shared/domain';
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

  /** 拉取最近 limit 条 commit，按时间倒序 */
  async getLog(limit: number = 100): Promise<Commit[]> {
    const output = await this.git.raw([
      'log',
      `--pretty=format:${LOG_FORMAT}`,
      '-n',
      String(limit),
    ]);
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
}
