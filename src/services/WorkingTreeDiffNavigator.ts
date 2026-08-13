import * as vscode from 'vscode';
import type {
  FileStatus,
  WorkingTreeGroup,
  WorkingTreeSnapshot,
} from '../../shared/domain';
import {
  workingTreeDiffSpec,
  type DiffEndpoint,
} from '../utils/workingTreeDiff';
import { diffSideRef, type DiffSide } from '../utils/diffRange';
import { getGitApi, type GitApi } from './RepoLocator';

export class WorkingTreeDiffNavigator implements vscode.Disposable {
  constructor(private readonly rootPath: string) {}

  async open(
    snapshot: WorkingTreeSnapshot,
    group: WorkingTreeGroup,
    path: string
  ): Promise<void> {
    const change = snapshot[group].find((item) => item.path === path);
    if (!change) throw new Error('The selected change is stale; refresh and try again');

    const spec = workingTreeDiffSpec(group, path, change.oldPath);
    const rootUri = vscode.Uri.file(this.rootPath);
    if ('mergePath' in spec) {
      const uri = vscode.Uri.joinPath(rootUri, spec.mergePath);
      const commands = await vscode.commands.getCommands(true);
      if (commands.includes('git.openMergeEditor')) {
        await vscode.commands.executeCommand('git.openMergeEditor', uri);
      } else {
        await vscode.commands.executeCommand('vscode.open', uri);
      }
      return;
    }

    const api = await getGitApi();
    if (!api) throw new Error('VS Code Git API is unavailable');
    const left = this.toUri(api, rootUri, spec.left, change.status, 'left');
    const right = this.toUri(api, rootUri, spec.right, change.status, 'right');
    const label = group === 'staged' ? 'Staged Changes' : 'Working Tree Changes';
    await vscode.commands.executeCommand('vscode.diff', left, right, `${path} (${label})`);
  }

  dispose(): void {}

  private toUri(
    api: GitApi,
    rootUri: vscode.Uri,
    endpoint: DiffEndpoint,
    status: FileStatus,
    side: DiffSide
  ): vscode.Uri {
    const fileUri = vscode.Uri.joinPath(rootUri, endpoint.path);
    if (endpoint.kind === 'file') return fileUri;
    return api.toGitUri(fileUri, diffSideRef(status, side, endpoint.ref));
  }
}
