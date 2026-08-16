/**
 * Minimal vscode module mock for integration tests.
 * Only implements the surface used by the message-flow under test.
 */
class MockEventEmitter<T> {
  private listeners = new Set<(arg: T) => void>();

  event = (listener: (arg: T) => void): { dispose(): void } => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };

  fire(arg: T): void {
    this.listeners.forEach((listener) => listener(arg));
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export const EventEmitter = MockEventEmitter;

export const window = {
  onDidChangeActiveTextEditor: () => ({ dispose: () => undefined }),
  showWarningMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showInformationMessage: async () => undefined,
};

export const commands = {
  executeCommand: async () => undefined,
  getCommands: async (): Promise<string[]> => [],
};

export const env = {
  language: 'en',
  clipboard: { writeText: async () => undefined },
};

export const workspace = {
  workspaceFolders: undefined as { uri: { fsPath: string } }[] | undefined,
};

export const Uri = {
  file: (fsPath: string) => ({ fsPath, toString: () => fsPath }),
  joinPath: (uri: { fsPath: string }, ...segments: string[]) => ({
    fsPath: [uri.fsPath, ...segments].join('/'),
    toString: () => [uri.fsPath, ...segments].join('/'),
  }),
};

// Filled in by the test before MessageHandler touches the git API
export const gitApiRef: { api: unknown } = { api: null };

export const extensions = {
  getExtension: () => ({
    isActive: true,
    exports: { getAPI: () => gitApiRef.api },
  }),
};
