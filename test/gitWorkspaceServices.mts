import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { GitService } from '../src/services/GitService.ts';
import { StashService } from '../src/services/StashService.ts';
import { WorkingTreeService } from '../src/services/WorkingTreeService.ts';

async function main() {
  const root = await mkdtemp(join(tmpdir(), 'gitmin-services-'));
  const remoteRoot = await mkdtemp(join(tmpdir(), 'gitmin-services-remote-'));
  const git = simpleGit(root);

  try {
    await git.init();

    // A freshly initialized repo has no commits yet; GitService should report
    // empty history and commit-less HEAD instead of surfacing a fatal error.
    const emptyGitService = new GitService(root);
    assert.equal(await emptyGitService.hasCommits(), false);
    assert.deepEqual(await emptyGitService.getLog(), []);
    assert.deepEqual(await emptyGitService.getBranches(), []);
    assert.deepEqual(await emptyGitService.getAuthors(), []);

    await git.addConfig('user.name', 'GitMin Test');
    await git.addConfig('user.email', 'gitmin@example.test');
    await writeFile(join(root, 'tracked.txt'), 'initial\n');
    await git.add(['tracked.txt']);
    await git.commit('initial');
    await simpleGit(remoteRoot).init(true);
    await git.addRemote('origin', remoteRoot);
    const branch = (await git.branchLocal()).current;
    await git.push(['-u', 'origin', branch]);

    const workingTree = new WorkingTreeService(root);
    const stashes = new StashService(root, new GitService(root));

    await writeFile(join(root, 'tracked.txt'), 'changed\n');
    await writeFile(join(root, 'untracked.txt'), 'new\n');
    let snapshot = await workingTree.getSnapshot();
    assert.deepEqual(snapshot.changes.map((file) => file.path), ['tracked.txt', 'untracked.txt']);

    await workingTree.stage(['tracked.txt']);
    snapshot = await workingTree.getSnapshot();
    assert.deepEqual(snapshot.staged.map((file) => file.path), ['tracked.txt']);
    const stagedDiff = await workingTree.getStagedDiff();
    assert.match(stagedDiff, /\+changed/);
    assert.doesNotMatch(stagedDiff, /untracked\.txt/);

    await workingTree.unstage(['tracked.txt']);
    assert.equal((await workingTree.getSnapshot()).staged.length, 0);

    await workingTree.stage(['tracked.txt']);
    await workingTree.commit('service commit');
    assert.equal((await git.log({ maxCount: 1 })).latest?.message, 'service commit');
    let commits = await new GitService(root).getLog();
    assert.equal(commits[0]?.isUnpushed, true);
    assert.equal(commits[1]?.isUnpushed, false);

    await git.push();
    commits = await new GitService(root).getLog();
    assert.equal(commits[0]?.isUnpushed, false);

    await writeFile(join(root, 'tracked.txt'), 'stash me\n');
    await workingTree.createStash('checkpoint');
    let list = await stashes.listRecent(10);
    assert.equal(list.length, 1);
    assert.match(list[0]!.message, /checkpoint/);
    assert.equal(await readFile(join(root, 'untracked.txt'), 'utf8'), 'new\n');

    const details = await stashes.getDetails(list[0]!);
    assert.equal(details.range.base, list[0]!.parentHash);
    assert.equal(details.range.head, list[0]!.hash);
    assert.deepEqual(details.files.map((file) => file.path), ['tracked.txt']);

    await stashes.apply(list[0]!.hash);
    assert.equal(await readFile(join(root, 'tracked.txt'), 'utf8'), 'stash me\n');
    assert.equal((await stashes.listRecent(10)).length, 1, 'apply must not drop');

    await assert.rejects(
      () => stashes.deleteVerified({ ...list[0]!, hash: '0'.repeat(40) }),
      /changed since it was loaded/
    );
    await stashes.deleteVerified(list[0]!);
    list = await stashes.listRecent(10);
    assert.equal(list.length, 0);

    await workingTree.discard('changes', ['tracked.txt', 'untracked.txt']);
    assert.equal(await readFile(join(root, 'tracked.txt'), 'utf8'), 'changed\n');
    await assert.rejects(() => readFile(join(root, 'untracked.txt')), /ENOENT/);

    console.log('git workspace service checks passed');
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(remoteRoot, { recursive: true, force: true }),
    ]);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
