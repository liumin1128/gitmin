/**
 * Integration test: after a commit completes, the working tree reload
 * (which drives the sidebar activity-bar badge) must carry a fresh snapshot.
 *
 * Replays the real MessageHandler + WorkspaceMessageController flow against a
 * real git repository, with a minimal vscode mock (see vscodeMock.ts):
 *   1. webview/ready        -> repo/info -> webview asks for working tree
 *   2. workingTree/loaded   -> snapshot with the staged file (badge count 1)
 *   3. workingTree/commit   -> workingTree/actionResult -> webview re-requests
 *   4. workingTree/loaded   -> snapshot WITHOUT the committed file (badge 0)
 *   5. external change (vscode.git onDidChange) -> workingTree/changed with
 *      the new git-status snapshot (badge count 1)
 *   6. while the webview is inactive, external commit/stash events still make
 *      the extension host read git status and publish a fresh snapshot
 */
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { MessageHandler } from '../src/ipc/MessageHandler.ts';
import { RepositorySelectionService } from '../src/services/RepositorySelectionService.ts';
import { FileDiffNavigator } from '../src/services/FileDiffNavigator.ts';
import type { CommitMessageGenerator } from '../src/services/CommitMessageGenerator.ts';
import type { WorkingTreeSnapshot } from '../shared/domain.ts';
import type { ExtensionMessage, WebviewMessage } from '../shared/messages.ts';
import { workingTreeChangeCount } from '../shared/workingTree.ts';
import { EventEmitter, gitApiRef } from './vscodeMock.ts';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(10);
  }
}

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'gitmin-badge-'));
  const git = simpleGit(root);

  try {
    await git.init();
    await git.addConfig('user.name', 'GitMin Test');
    await git.addConfig('user.email', 'gitmin@example.test');
    await writeFile(join(root, 'a.txt'), 'one\n');
    await git.add(['a.txt']);
    const initialCommit = await git.commit('initial');

    // Stage a second file so the initial badge count is 1
    await writeFile(join(root, 'b.txt'), 'two\n');
    await git.add(['b.txt']);

    // ---- vscode.git API mock ----
    const repoStateEmitter = new EventEmitter<void>();
    const onOpenRepoEmitter = new EventEmitter<unknown>();
    gitApiRef.api = {
      repositories: [
        {
          rootUri: { fsPath: root },
          state: { HEAD: { name: 'main' }, onDidChange: repoStateEmitter.event },
        },
      ],
      onDidOpenRepository: onOpenRepoEmitter.event,
      toGitUri: () => ({}),
    };

    // ---- extension services ----
    const stateMap = new Map<string, unknown>();
    const workspaceState = {
      get: <T,>(key: string): T | undefined => stateMap.get(key) as T | undefined,
      update: async (key: string, value: unknown) => {
        stateMap.set(key, value);
      },
    };
    const repositorySelection = new RepositorySelectionService(
      workspaceState,
      async () => gitApiRef.api as never,
      () => [root],
    );
    const fileDiffNavigator = new FileDiffNavigator();
    const commitMessageGenerator = {
      generate: async () => null,
    } as unknown as CommitMessageGenerator;

    // ---- webview simulation: respond to extension messages ----
    const posts: ExtensionMessage[] = [];
    const workingTreeSnapshots: WorkingTreeSnapshot[] = [];
    let wtRequestId = 0;
    let webviewActive = true;
    let handler!: MessageHandler;
    const post = (msg: ExtensionMessage): void => {
      posts.push(msg);
      if (msg.type === 'workingTree/loaded' || msg.type === 'workingTree/changed') {
        workingTreeSnapshots.push(msg.snapshot);
      }
      if (!webviewActive) return;
      const refresh =
        msg.type === 'repo/info' ||
        (msg.type === 'workingTree/actionResult' && msg.refresh.includes('changes'));
      if (refresh) {
        queueMicrotask(() => {
          void handler.handle({
            type: 'workingTree/request',
            requestId: ++wtRequestId,
          } satisfies WebviewMessage);
        });
      }
    };

    handler = new MessageHandler(
      post,
      { fsPath: '/ext' } as never,
      fileDiffNavigator,
      workspaceState,
      repositorySelection,
      commitMessageGenerator,
    );

    const lastLoaded = (): Extract<ExtensionMessage, { type: 'workingTree/loaded' }> | undefined =>
      [...posts].reverse().find((m) => m.type === 'workingTree/loaded') as never;
    const lastSnapshot = (): WorkingTreeSnapshot | undefined => workingTreeSnapshots.at(-1);

    // ---- 1. boot the view ----
    await handler.handle({ type: 'webview/ready', requestId: 1, limit: 50 });
    await waitFor(() => lastLoaded() !== undefined);
    assert.equal(
      workingTreeChangeCount(lastLoaded()!.snapshot),
      1,
      'initial badge count should reflect the staged file',
    );
    assert.equal(lastLoaded()!.snapshot.staged.length, 1);

    // ---- 2. commit via the panel ----
    await handler.handle({
      type: 'workingTree/commit',
      requestId: 100,
      message: 'second',
    });
    const commitResultIndex = posts.findIndex(
      (m) => m.type === 'workingTree/actionResult' && m.operation === 'commit' && m.ok,
    );
    assert.ok(commitResultIndex >= 0, 'commit should post a successful actionResult');
    assert.deepEqual(
      (posts[commitResultIndex] as Extract<ExtensionMessage, { type: 'workingTree/actionResult' }>).refresh,
      ['changes', 'commits'],
    );
    await waitFor(() =>
      posts.slice(commitResultIndex + 1).some((m) => m.type === 'workingTree/loaded'),
    );
    const loadedAfterCommit = lastLoaded()!;
    assert.equal(
      workingTreeChangeCount(loadedAfterCommit.snapshot),
      0,
      'badge count must drop to 0 after the commit reloads the working tree',
    );
    assert.equal(loadedAfterCommit.snapshot.staged.length, 0);

    // ---- 3. external change detected by vscode.git ----
    await writeFile(join(root, 'c.txt'), 'three\n');
    repoStateEmitter.fire();
    await waitFor(() => posts.some((m) => m.type === 'workingTree/changed'));
    await waitFor(() => workingTreeChangeCount(lastSnapshot()!) === 1);
    assert.equal(
      lastSnapshot()!.changes.map((c) => c.path).join(','),
      'c.txt',
      'badge count must rise for an externally created file',
    );

    // ---- 4. external commit while the webview is inactive ----
    webviewActive = false;
    await git.add(['c.txt']);
    await git.commit('external commit');
    let previousSnapshotCount = workingTreeSnapshots.length;
    repoStateEmitter.fire();
    await waitFor(() => workingTreeSnapshots.length > previousSnapshotCount);
    assert.equal(
      workingTreeChangeCount(lastSnapshot()!),
      0,
      'badge count must drop after an external commit without a webview request',
    );

    // ---- 5. external stash while the webview is inactive ----
    await writeFile(join(root, 'a.txt'), 'stashed\n');
    previousSnapshotCount = workingTreeSnapshots.length;
    repoStateEmitter.fire();
    await waitFor(() => workingTreeSnapshots.length > previousSnapshotCount);
    assert.equal(workingTreeChangeCount(lastSnapshot()!), 1);

    await git.stash();
    previousSnapshotCount = workingTreeSnapshots.length;
    repoStateEmitter.fire();
    await waitFor(() => workingTreeSnapshots.length > previousSnapshotCount);
    assert.equal(
      workingTreeChangeCount(lastSnapshot()!),
      0,
      'badge count must drop after an external stash without a webview request',
    );

    // ---- 6. reset --soft via action/execute must reload the working tree ----
    const initialHash = initialCommit.commit;
    await handler.handle({
      type: 'action/execute',
      action: 'reset-soft',
      hashes: [initialHash],
    });
    await waitFor(() =>
      posts.some((m) => m.type === 'action/result' && m.action === 'reset-soft' && m.ok),
    );
    assert.ok(
      posts.some((m) => m.type === 'workingTree/changed'),
      'reset must publish the refreshed working tree',
    );
    await waitFor(() => {
      const snapshot = lastSnapshot();
      return snapshot !== undefined && snapshot.staged.some((c) => c.path === 'b.txt');
    });
    assert.ok(
      workingTreeChangeCount(lastSnapshot()!) >= 2,
      'badge count must reflect the reset-soft staged changes',
    );

    console.log('badge flow integration checks passed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
