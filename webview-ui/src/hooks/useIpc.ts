/**
 * Webview <-> Extension 消息通道封装
 * - postMessage: 类型安全的发消息
 * - useIpcListener: 类型安全订阅某类消息
 */
import { useEffect, useRef } from 'react';
import type { ExtensionMessage, WebviewMessage } from '../../../shared/messages';

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

// 只能调用一次，缓存单例
let vscodeApi: VsCodeApi | null = null;
function getApi(): VsCodeApi {
  if (!vscodeApi) vscodeApi = acquireVsCodeApi();
  return vscodeApi;
}

export function postMessage(msg: WebviewMessage): void {
  getApi().postMessage(msg);
}

/**
 * 订阅某一类型的 extension 消息
 * 用 ref 保持最新 handler 引用，避免重复注册
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
