/**
 * Bridge used by the webview/jsdom integration test: instantiates the real
 * extension-host MessageHandler against a real repository and forwards IPC.
 * Bundled with `vscode` aliased to test/stubs/vscode.mjs (see runStubbedTest).
 */
import * as vscode from 'vscode';
import { MessageHandler } from '../src/ipc/MessageHandler.ts';
import { FileDiffNavigator } from '../src/services/FileDiffNavigator.ts';
import { RepositorySelectionService } from '../src/services/RepositorySelectionService.ts';
import { getGitApi } from '../src/services/RepoLocator.ts';
import type { ExtensionMessage, WebviewMessage } from '../shared/messages.ts';

interface HostOptions {
  rootPath: string;
  post: (message: ExtensionMessage) => void;
}

export function createHost({ rootPath, post }: HostOptions) {
  const repository = {
    rootUri: vscode.Uri.file(rootPath),
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

  const store = new Map<string, unknown>();
  const workspaceState = {
    get: <T>(key: string) => store.get(key) as T | undefined,
    update: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  };

  const handler = new MessageHandler(
    (message) => post(message),
    vscode.Uri.file('/extension'),
    new FileDiffNavigator(),
    workspaceState,
    new RepositorySelectionService(workspaceState, getGitApi, () => [rootPath]),
    { generate: async () => null } as never
  );

  return {
    handle: (message: WebviewMessage) => handler.handle(message),
    dispose: () => handler.dispose(),
  };
}
