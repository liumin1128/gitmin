import assert from 'node:assert/strict';
import { configureLocale } from '../shared/i18n.ts';
import type { ExtensionMessage } from '../shared/messages.ts';
import { toNativeNotification } from '../src/utils/extensionMessageNotification.ts';

configureLocale('en');

const notificationFor = (message: ExtensionMessage) => toNativeNotification(message);

assert.deepEqual(
  notificationFor({ type: 'repo/none', reason: 'No repository' }),
  { level: 'warning', message: 'No repository' }
);
assert.deepEqual(
  notificationFor({ type: 'commits/error', requestId: 1, error: 'Log failed' }),
  { level: 'error', message: 'Log failed' }
);
assert.deepEqual(
  notificationFor({
    type: 'workingTree/actionResult',
    requestId: 2,
    operation: 'stash',
    ok: true,
    refresh: ['changes', 'stashes'],
  }),
  { level: 'information', message: 'Changes stashed' }
);
assert.deepEqual(
  notificationFor({
    type: 'workingTree/commitMessageResult',
    requestId: 3,
    ok: false,
    error: 'Generation failed',
  }),
  { level: 'error', message: 'Generation failed' }
);
assert.deepEqual(
  notificationFor({ type: 'action/result', action: 'drop', ok: false, message: 'Denied' }),
  { level: 'error', message: 'Git operation failed: Denied' }
);
assert.equal(
  notificationFor({
    type: 'workingTree/actionResult',
    requestId: 4,
    operation: 'discard',
    ok: false,
    message: 'Cancelled',
    refresh: [],
  }),
  null
);
assert.equal(
  notificationFor({ type: 'repositories/loaded', snapshot: { repositories: [], selectedRootPath: null } }),
  null
);

console.log('extension message notification checks passed');
