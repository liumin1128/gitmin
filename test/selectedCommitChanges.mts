import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { GitService } from '../src/services/GitService.ts';
import { computeDiffRange, EMPTY_TREE_HASH } from '../src/utils/diffRange.ts';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'gitmin-selected-commits-'));
  const git = simpleGit(root);
  const service = new GitService(root);
  const write = (path: string, content: string | Buffer) => writeFile(join(root, path), content);
  const commit = async (message: string, author?: string) => {
    await git.add(['-A']);
    await git.commit(message, author ? { '--author': author } : {});
    return (await git.revparse('HEAD')).trim();
  };

  try {
    await git.init();
    await git.addConfig('user.name', 'Selected Author');
    await git.addConfig('user.email', 'selected@example.test');
    for (const path of ['early.txt', 'late.txt', 'shared.txt', 'deleted.txt']) {
      await write(path, 'initial\n');
    }
    await write('old name.txt', 'rename\n'.repeat(20));
    const initial = await commit('initial');

    await write('early.txt', 'selected early\n');
    await write('shared.txt', 'selected first\n');
    await write('temporary.txt', 'temporary\n');
    await write('新文件\tname.txt', 'new\n');
    await write('binary.bin', Buffer.from([0, 1, 2]));
    await git.mv('old name.txt', 'new name.txt');
    await git.rm('deleted.txt');
    const first = await commit('first selected');

    await write('early.txt', 'unselected later change\n');
    await write('late.txt', 'unselected earlier change\n');
    await write('shared.txt', 'selected first\nunselected middle\n');
    await write('unselected.txt', 'foreign\n');
    const middle = await commit('unselected', 'Other Author <other@example.test>');

    await write('late.txt', 'unselected earlier change\nselected late\n');
    await write('shared.txt', 'selected first\nunselected middle\nselected second\n');
    await write('new name.txt', 'rename\n'.repeat(20) + 'selected rename edit\n');
    await write('新文件\tname.txt', 'new\nselected addition\n');
    await write('binary.bin', Buffer.from([0, 3, 4]));
    await git.rm('temporary.txt');
    await write('deleted.txt', 'restored\n');
    const second = await commit('second selected');

    // Author filtering hides the intervening commit without making history contiguous.
    const commits = await service.getLog({ filters: { author: 'Selected Author' } });
    assert.equal(commits.some((entry) => entry.hash === middle), false);
    assert.equal(computeDiffRange([first, second], commits)?.contiguous, false);

    const files = await service.getSelectedCommitChanges([first, second, first], commits);
    assert.deepEqual(files.map((file) => file.path).sort(), [
      'binary.bin', 'deleted.txt', 'early.txt', 'late.txt',
      'new name.txt', 'shared.txt', '新文件\tname.txt',
    ].sort());
    const byPath = new Map(files.map((file) => [file.path, file]));
    assert.deepEqual(byPath.get('early.txt')?.diffRange, { base: initial, head: first });
    assert.deepEqual(byPath.get('late.txt')?.diffRange, { base: middle, head: second });
    assert.equal(byPath.get('late.txt')?.insertions, 1);
    assert.equal(byPath.get('late.txt')?.deletions, 0);
    assert.equal(byPath.get('新文件\tname.txt')?.status, 'A');
    assert.equal(byPath.get('binary.bin')?.binary, true);
    assert.equal(byPath.get('deleted.txt')?.status, 'M');
    assert.equal(byPath.get('new name.txt')?.status, 'R');
    assert.equal(byPath.get('new name.txt')?.oldPath, 'old name.txt');
    assert.equal(byPath.get('new name.txt')?.insertions, 1);
    assert.equal(byPath.get('new name.txt')?.deletions, 0);
    assert.deepEqual(byPath.get('new name.txt')?.diffRange, { base: initial, head: second });
    // A combined view of the same file uses its first before/last after revisions.
    assert.deepEqual(byPath.get('shared.txt')?.diffRange, { base: initial, head: second });
    assert.equal(byPath.get('shared.txt')?.insertions, 3);
    assert.equal(byPath.get('shared.txt')?.deletions, 1);

    const firstOnly = await service.getSelectedCommitChanges([first], commits);
    assert.equal(firstOnly.find((file) => file.path === 'deleted.txt')?.status, 'D');
    const rootFiles = await service.getSelectedCommitChanges([initial], commits);
    assert.ok(rootFiles.every((file) => file.status === 'A' && file.diffRange?.base === EMPTY_TREE_HASH));
    assert.deepEqual(await service.getSelectedCommitChanges([], commits), []);
    const aborted = new AbortController();
    aborted.abort();
    await assert.rejects(service.getSelectedCommitChanges([first], commits, aborted.signal), /abort/i);

    console.log('selected commit changes checks passed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
