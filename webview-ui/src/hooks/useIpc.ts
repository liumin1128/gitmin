/**
 * Webview <-> Extension message channel wrapper
 * - postMessage: type-safe message sending
 * - useIpcListener: type-safe subscription to a message type
 */
import { useEffect, useRef } from 'react';
import type { ExtensionMessage, WebviewMessage } from '../../../shared/messages';

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// Can only be called once, cache singleton
let vscodeApi: VsCodeApi | null = null;
function getApi(): VsCodeApi {
  if (!vscodeApi) vscodeApi = acquireVsCodeApi();
  return vscodeApi;
}

export function postMessage(msg: WebviewMessage): void {
  getApi().postMessage(msg);
}

export function getWebviewState<T>(): T | undefined {
  return getApi().getState<T>();
}

export function setWebviewState<T>(state: T): void {
  getApi().setState(state);
}

/**
 * Subscribe to a specific type of extension message
 * Uses ref to keep the latest handler reference, avoiding repeated registration
 */
export function useIpcListener<T extends ExtensionMessage['type']>(
  type: T,
  handler: (msg: Extract<ExtensionMessage, { type: T }>) => void
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (e: MessageEvent) => {
      const msg = e.data as ExtensionMessage;
      if (msg && msg.type === type) {
        handlerRef.current(msg as Extract<ExtensionMessage, { type: T }>);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [type]);
}
