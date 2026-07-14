import { simpleGit, type SimpleGit } from 'simple-git';
import type {
  CommitDetails,
  DiffRange,
  FileChange,
  StashEntry,
} from '../../shared/domain';
import { STASH_LIST_FORMAT, parseStashList } from '../utils/stashParser';
import { GitService } from './GitService';

export interface StashDetails {
  entry: StashEntry;
  range: DiffRange;
  files: FileChange[];
  details: CommitDetails[];
}

export class StashService {
  private readonly git: SimpleGit;
  private readonly gitService: GitService;

  constructor(rootPath: string, gitService: GitService) {
    this.git = simpleGit(rootPath);
    this.gitService = gitService;
  }

  async listRecent(limit: number = 10): Promise<StashEntry[]> {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(100, Math.max(1, Math.floor(limit)))
      : 10;
    const output = await this.git.raw([
      'stash',
      'list',
      '-n',
      String(normalizedLimit),
      `--format=${STASH_LIST_FORMAT}`,
    ]);
    return parseStashList(output);
  }

  async getDetails(entry: StashEntry): Promise<StashDetails> {
    await this.assertCurrent(entry);
    const range: DiffRange = {
      base: entry.parentHash,
      head: entry.hash,
      contiguous: true,
    };
    const [files, details] = await Promise.all([
      this.gitService.getDiffSummary(range.base, range.head),
      this.gitService.getCommitDetails([entry.hash]),
    ]);
    return { entry, range, files, details };
  }

  async apply(hash: string): Promise<void> {
    if (!hash) throw new Error('A stash is required');
    await this.git.raw(['stash', 'apply', hash]);
  }

  async deleteVerified(entry: StashEntry): Promise<void> {
    await this.assertCurrent(entry);
    await this.git.raw(['stash', 'drop', entry.selector]);
  }

  private async assertCurrent(entry: StashEntry): Promise<void> {
    let currentHash: string;
    try {
      currentHash = (await this.git.raw(['rev-parse', entry.selector])).trim();
    } catch {
      throw new Error('The selected stash no longer exists');
    }
    if (currentHash !== entry.hash) {
      throw new Error('The selected stash changed since it was loaded');
    }
  }
}
