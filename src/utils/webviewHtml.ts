/**
 * 共享的 Webview HTML 拼装
 * 供 WebviewPanel 与 WebviewView 复用
 */
import * as vscode from 'vscode';
import { getNonce } from './nonce';

export function buildWebviewHtml(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview', 'index.css')
  );
  const nonce = getNonce();
  const csp = webview.cspSource;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${csp} data: https:; font-src ${csp};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Git Commit Panel</title>
  <style>
    #root:empty::before { content: "Loading Git Commit Panel..."; display: block; padding: 20px; color: #888; font-family: sans-serif; }
    #__err { display: none; padding: 12px; color: #ff6b6b; font-family: monospace; white-space: pre-wrap; background: #2a1414; border-bottom: 1px solid #ff6b6b; font-size: 12px; }
  </style>
</head>
<body>
  <div id="__err"></div>
  <div id="root"></div>
  <script nonce="${nonce}">
    (function() {
      function show(msg) {
        var el = document.getElementById('__err');
        el.style.display = 'block';
        el.textContent = (el.textContent ? el.textContent + '\\n---\\n' : '') + msg;
      }
      window.addEventListener('error', function(e) {
        show('[error] ' + (e.message || '') + '\\n' + ((e.error && e.error.stack) || ''));
      });
      window.addEventListener('unhandledrejection', function(e) {
        show('[promise] ' + (e.reason && (e.reason.stack || e.reason.message || e.reason)));
      });
    })();
  </script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
