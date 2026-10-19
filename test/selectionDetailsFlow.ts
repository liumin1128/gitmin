/**
 * End-to-end (extension host side) check for the "click a commit" flow.
 *
 * Runs the real MessageHandler + WorkspaceMessageController against a real
 * temporary git repository while emulating the exact IPC sequence the webview
 * produces (see useCommits / useSelectionDetails).
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import * as vscode from './stubs/vscode.mjs';
import { MessageHandler } from '../src/ipc/MessageHandler.ts';
import { FileDiffNavigator } from '../src/services/FileDiffNavigator.ts';
import { RepositorySelectionService } from '../src/services/RepositorySelectionService.ts';
import { getGitApi } from '../src/services/RepoLocator.ts';
import type { ExtensionMessage, WebviewMessage } from '../shared/messages.ts';
import type { CommitDetails, Commit, DiffRange, FileChange } from '../shared/domain.ts';

class FakeWebview {
  commitRequestId = 0;
  selectionRequestId = 0;
  commits: Commit[] = [];
  files: FileChange[] = [];
  range: DiffRange | null = null;
  details: CommitDetails[] = [];
  filesLoading = false;
  detailsLoading = false;
  lastError: string | null = null;

  /** Mirrors the mount-time effects: useCommits handshake + useSelectionDetails clear */
  mount(): void {
    const ready = ++this.commitRequestId;
    send({ type: 'webview/ready', requestId: ready, limit: 100 });
    this.clearSelection();
  }

  clearSelection(): void {
    const requestId = ++this.selectionRequestId;
    this.filesLoading = false;
    this.detailsLoading = false;
    send({ type: 'selectionDetails/clear', requestId });
  }

  clickCommit(hash: string): void {
    const requestId = ++this.selectionRequestId;
    this.filesLoading = true;
    this.detailsLoading = true;
    send({
      type: 'selectionDetails/request',
      requestId,
      selection: { kind: 'commits', hashes: [hash] },
    });
  }

  handle(message: ExtensionMessage): void {
    switch (message.type) {
      case 'commits/loaded':
        this.commits = message.page.commits;
        return;
      case 'selectionDetails/filesLoaded':
        if (message.requestId !== this.selectionRequestId) return;
        this.range = message.range;
        this.files = message.files;
        this.filesLoading = false;
        return;
      case 'selectionDetails/detailsLoaded':
        if (message.requestId !== this.selectionRequestId) return;
        this.details = message.details;
        this.detailsLoading = false;
        return;
      case 'selectionDetails/error':
        if (message.requestId !== this.selectionRequestId) return;
        this.lastError = `${message.target}: ${message.error}`;
        if (message.target === 'files' || message.target === 'all') {
          this.range = null;
          this.files = [];
          this.filesLoading = false;
        }
        if (message.target === 'details' || message.target === 'all') {
          this.details = [];
          this.detailsLoading = false;
        }
        return;
      default:
        return;
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const host = {
  handler: null as unknown as MessageHandler,
  posted: [] as ExtensionMessage[],
  listener: (_message: ExtensionMessage) => {},
};

/** Mimics `webview.postMessage`: delivery is asynchronous, dispatch is not awaited. */
function emit(message: ExtensionMessage): void {
  host.posted.push(message);
  host.listener(message);
}

/** Mimics `webview.onDidReceiveMessage`: the host never awaits the handler. */
function send(message: WebviewMessage): void {
  void host.handler.handle(message);
}

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'gitmin-selection-'));
  const git = simpleGit(root);

  try {
    await git.init();
    await git.addConfig('user.name', 'GitMin Test');
    await git.addConfig('user.email', 'gitmin@example.test');

    await writeFile(join(root, 'a.txt'), 'one\n');
    await git.add(['a.txt']);
    await git.commit('first');

    await writeFile(join(root, 'b.txt'), 'two\n');
    await writeFile(join(root, 'a.txt'), 'one\ntwo\n');
    await git.add(['a.txt', 'b.txt']);
    await git.commit('second');

    const repository = {
      rootUri: vscode.Uri.file(root),
      state: {
        HEAD: { name: 'main' },
        onDidChange: new vscode.EventEmitter().event,
      },
    };
    const gitApi = {
      repositories: [repository],
      toGitUri: (uri: vscode.Uri) => uri,
      onDidOpenRepository: new vscode.EventEmitter().event,
      onDidCloseRepository: new vscode.EventEmitter().event,
      getAPI: () => gitApi,
    };
    vscode.extensions.getExtension = () => ({
      isActive: true,
      exports: gitApi,
      activate: async () => gitApi,
    });

    const repositorySelection = new RepositorySelectionService(
      createWorkspaceState(),
      getGitApi,
      () => [root]
    );
    host.handler = new MessageHandler(
      emit,
      vscode.Uri.file('/extension'),
      new FileDiffNavigator(),
      createWorkspaceState(),
      repositorySelection,
      { generate: async () => null } as never
    );

    const webview = new FakeWebview();
    host.posted = [];
    host.listener = (message) => webview.handle(message);

    webview.mount();
    await delay(1500);
    assert.ok(webview.commits.length >= 2, 'commit list should load');

    const head = webview.commits[0]!;
    webview.clickCommit(head.hash);
    await delay(1500);

    console.log('posted message types:', host.posted.map((m) => m.type).join(', '));
    console.log('files:', JSON.stringify(webview.files));
    console.log('details:', webview.details.length, 'error:', webview.lastError);
    assert.equal(webview.lastError, null, 'selection details must not fail');
    assert.equal(webview.details.length, 1, 'commit details should load for the clicked commit');
    assert.ok(webview.files.length > 0, 'changed files should load for the clicked commit');

    console.log('selection details flow checks passed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

function createWorkspaceState() {
  const store = new Map<string, unknown>();
  return {
    get: <T>(key: string) => store.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
