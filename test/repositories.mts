import assert from 'node:assert/strict';
import {
  getRepositoryName,
  resolveSelectedRepository,
  type RepositorySummary,
} from '../shared/repositories.ts';
import { RepositorySelectionService } from '../src/services/RepositorySelectionService.ts';
import { CommitRequestGuard } from '../src/ipc/CommitRequestGuard.ts';

type Listener<T> = (value: T) => void;

function eventSource<T>() {
  const listeners = new Set<Listener<T>>();
  return {
    event(listener: Listener<T>) {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    fire(value: T) {
      listeners.forEach((listener) => listener(value));
    },
  };
}

function repository(rootPath: string, branch: string) {
  const changes = eventSource<void>();
  return {
    rootUri: { fsPath: rootPath },
    state: {
      HEAD: { name: branch },
      onDidChange: changes.event,
    },
    changes,
  };
}

async function main() {
  const summaries: RepositorySummary[] = [
    { rootPath: '/workspace/api', name: 'api', currentBranch: 'main' },
    { rootPath: '/workspace/web', name: 'web', currentBranch: 'feature/repos' },
  ];

  assert.equal(getRepositoryName('/workspace/api'), 'api');
  assert.equal(getRepositoryName('C:\\workspace\\web'), 'web');
  assert.equal(resolveSelectedRepository(summaries, '/workspace/api', '/workspace/web'), '/workspace/api');
  assert.equal(resolveSelectedRepository(summaries, '/missing', '/workspace/web'), '/workspace/web');
  assert.equal(resolveSelectedRepository(summaries, '/missing', '/also-missing'), '/workspace/api');
  assert.equal(resolveSelectedRepository([], '/workspace/api', '/workspace/web'), null);

  const requestGuard = new CommitRequestGuard();
  assert.equal(requestGuard.reserve(1, 0), true);
  requestGuard.reset();
  assert.equal(requestGuard.isReserved(1, 0), false);
  assert.equal(requestGuard.reserve(2, 0), true);

  const apiRepo = repository('/workspace/api', 'main');
  const webRepo = repository('/workspace/web', 'feature/repos');
  const opened = eventSource<unknown>();
  const closed = eventSource<unknown>();
  const values = new Map<string, unknown>([['gitmin.selectedRepository', '/workspace/web']]);
  const updates: Array<[string, unknown]> = [];
  const workspaceState = {
    get<T>(key: string): T | undefined {
      return values.get(key) as T | undefined;
    },
    async update(key: string, value: unknown) {
      values.set(key, value);
      updates.push([key, value]);
    },
  };
  const api = {
    repositories: [apiRepo, webRepo],
    onDidOpenRepository: opened.event,
    onDidCloseRepository: closed.event,
  };
  const service = new RepositorySelectionService(workspaceState, async () => api as never);
  const events: Array<{ selectedRootPath: string | null; selectionChanged: boolean }> = [];
  service.onDidChange((event) => events.push(event));

  await service.initialize();
  assert.equal(service.getSnapshot().selectedRootPath, '/workspace/web');
  assert.equal(service.getSnapshot().repositories[1]?.currentBranch, 'feature/repos');

  await service.select('/workspace/api');
  assert.equal(service.getSnapshot().selectedRootPath, '/workspace/api');
  assert.deepEqual(updates.at(-1), ['gitmin.selectedRepository', '/workspace/api']);
  assert.equal(events.at(-1)?.selectionChanged, true);

  api.repositories.splice(0, 1);
  closed.fire(apiRepo);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.getSnapshot().selectedRootPath, '/workspace/web');
  assert.deepEqual(updates.at(-1), ['gitmin.selectedRepository', '/workspace/web']);

  webRepo.state.HEAD.name = 'release';
  webRepo.changes.fire(undefined);
  assert.equal(service.getSnapshot().repositories[0]?.currentBranch, 'release');
  assert.equal(events.at(-1)?.selectionChanged, false);

  await assert.rejects(() => service.select('/workspace/missing'), /not available/i);
  service.dispose();

  console.log('repository selection checks passed');
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
