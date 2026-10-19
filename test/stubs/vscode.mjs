/**
 * Minimal `vscode` module stub, used to bundle extension-host code for Node tests.
 * Only the members touched by the modules under test are implemented.
 */

export class EventEmitter {
  constructor() {
    this.listeners = new Set();
    this.event = (listener) => {
      this.listeners.add(listener);
      return { dispose: () => this.listeners.delete(listener) };
    };
  }

  fire(value) {
    for (const listener of [...this.listeners]) listener(value);
  }

  dispose() {
    this.listeners.clear();
  }
}

export class Uri {
  constructor(fsPath) {
    this.scheme = 'file';
    this.fsPath = fsPath;
    this.path = fsPath;
  }

  static file(fsPath) {
    return new Uri(fsPath);
  }

  static joinPath(base, ...segments) {
    return new Uri([base.fsPath.replace(/\/$/, ''), ...segments].join('/'));
  }

  toString() {
    return `file://${this.fsPath}`;
  }
}

export const commands = {
  executeCommand: async () => undefined,
  getCommands: async () => [],
  registerCommand: () => ({ dispose() {} }),
};

export const window = {
  onDidChangeActiveTextEditor: () => ({ dispose() {} }),
  showErrorMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showInformationMessage: async () => undefined,
  showInputBox: async () => undefined,
  showQuickPick: async () => undefined,
  withProgress: async (_options, task) => task(),
};

export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: (_key, fallback) => fallback,
    inspect: () => undefined,
    update: async () => undefined,
  }),
  onDidChangeWorkspaceFolders: () => ({ dispose() {} }),
};

export const env = { language: 'zh-cn' };

export const extensions = {
  all: [],
  getExtension: () => undefined,
};

export const lm = { selectChatModels: async () => [] };

export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 };
export const ProgressLocation = { Notification: 15 };
export const ViewColumn = { Active: -1 };
export const StatusBarAlignment = { Left: 1, Right: 2 };

export class Disposable {
  constructor(callOnDispose) {
    this.callOnDispose = callOnDispose;
  }

  dispose() {
    this.callOnDispose?.();
  }
}
