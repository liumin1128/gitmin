/**
 * Visual reproduction helper: renders the built webview bundle in headless
 * Chrome, wired to the real extension host, using a given persisted webview
 * state and viewport size. Clicks the first commit row and reports the panel
 * geometry (plus an optional screenshot).
 *
 * Usage: node test/webviewVisualCheck.mjs [--height=1317] [--width=991] [--shot=/tmp/shot.png]
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const requireFromHere = createRequire(import.meta.url);
const repoPath = process.cwd();

function argValue(name, fallback) {
  const prefix = `--${name}=`;
  const match = process.argv.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

const viewportWidth = Number(argValue('width', '991'));
const viewportHeight = Number(argValue('height', '1317'));
const screenshotPath = argValue('shot', '/tmp/gitmin-webview-shot.png');
const dragFiles = argValue('dragFiles', null);
const persistedState =
  process.argv.includes('--user-state')
    ? JSON.parse(readFileSync(argValue('stateFile', '/tmp/gitmin-webview-state.json'), 'utf8'))
    : undefined;

const delay = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitFor(check, timeoutMs = 20000, label = 'condition') {
  const started = Date.now();
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${label}`);
    await delay(50);
  }
}

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Set();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve: settle, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else settle(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((settle, reject) => {
      this.pending.set(id, { resolve: settle, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  onEvent(listener) {
    this.listeners.add(listener);
  }
}

let host;
let cdp;
let chrome;
let pageDir;
let profileDir;
const webviewMessages = [];

async function sendToWebview(message) {
  await cdp.send('Runtime.evaluate', {
    expression: `window.__receive(${JSON.stringify(JSON.stringify(message))})`,
    awaitPromise: false,
  });
}

async function evaluate(expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(`page evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
  }
  return result.result?.value;
}

async function main() {
  // 1. Extension host bridge
  const bridgePath = join(tmpdir(), `gitmin-visual-bridge-${process.pid}.cjs`);
  await build({
    entryPoints: [resolve('test/webviewHostBridge.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: bridgePath,
    logLevel: 'silent',
    alias: { vscode: resolve('test/stubs/vscode.mjs') },
  });
  const { createHost } = requireFromHere(bridgePath);
  host = createHost({ rootPath: repoPath, post: sendToWebview });
  await rm(bridgePath, { force: true });

  // 2. Static page that loads the real bundle + stylesheet
  pageDir = await mkdtemp(join(tmpdir(), 'gitmin-webview-page-'));
  if (!existsSync(resolve('out/webview/index.js'))) {
    throw new Error('out/webview/index.js is missing - run `npm run build` first');
  }
  await cp(resolve('out/webview/index.js'), join(pageDir, 'index.js'));
  await cp(resolve('out/webview/index.css'), join(pageDir, 'index.css'));
  for (const file of await readdir(resolve('out/webview'))) {
    if (file.endsWith('.ttf')) await cp(join(resolve('out/webview'), file), join(pageDir, file));
  }
  const html = `<!DOCTYPE html>
<html lang="zh-cn">
<head>
<meta charset="utf-8" />
<link rel="stylesheet" href="index.css" />
<style>
  :root {
    --vscode-font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    --vscode-font-size: 13px;
    --vscode-foreground: #d4d4d4;
    --vscode-descriptionForeground: #9d9d9d;
    --vscode-icon-foreground: #c5c5c5;
    --vscode-editor-background: #1e1e1e;
    --vscode-editor-foreground: #d4d4d4;
    --vscode-sideBar-background: #181818;
    --vscode-sideBarSectionHeader-background: #1f1f1f;
    --vscode-panel-border: #2b2b2b;
    --vscode-list-hoverBackground: #ffffff1a;
    --vscode-list-activeSelectionBackground: #094771;
    --vscode-list-activeSelectionForeground: #ffffff;
    --vscode-badge-background: #4d4d4d;
    --vscode-badge-foreground: #ffffff;
    --vscode-button-background: #0e639c;
    --vscode-button-foreground: #ffffff;
    --vscode-input-background: #3c3c3c;
    --vscode-input-foreground: #cccccc;
    --vscode-focusBorder: #007fd4;
    --vscode-editorWarning-foreground: #cca700;
    --vscode-gitDecoration-modifiedResourceForeground: #e2c08d;
  }
  html, body { height: 100%; margin: 0; }
  body { background: var(--vscode-sideBar-background); color: var(--vscode-foreground); }
  #root { height: 100%; }
</style>
</head>
<body data-gitmin-host="view">
<div id="root"></div>
<script>
  window.__state = ${JSON.stringify(persistedState ?? null)};
  window.__receive = (json) => {
    window.dispatchEvent(new MessageEvent('message', { data: JSON.parse(json) }));
  };
  window.acquireVsCodeApi = () => ({
    postMessage: (message) => window.__sendToHost(JSON.stringify(message)),
    getState: () => window.__state ?? undefined,
    setState: (state) => { window.__state = state; },
  });
</script>
<script src="index.js"></script>
</body>
</html>`;
  await writeFile(join(pageDir, 'index.html'), html);

  // 3. Headless Chrome + CDP
  profileDir = await mkdtemp(join(tmpdir(), 'gitmin-chrome-'));
  const port = 9333;
  const chromePath =
    process.env.CHROME_PATH ??
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (!existsSync(chromePath)) {
    throw new Error(`Chrome not found at ${chromePath}; set CHROME_PATH to override`);
  }
  chrome = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${viewportWidth},${viewportHeight}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  const target = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      return targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl);
    } catch {
      return null;
    }
  }, 20000, 'chrome devtools');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((settle, reject) => {
    socket.addEventListener('open', settle, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  cdp = new Cdp(socket);
  cdp.onEvent((message) => {
    if (message.method === 'Runtime.bindingCalled' && message.params.name === '__sendToHost') {
      const payload = JSON.parse(message.params.payload);
      webviewMessages.push(payload);
      void host.handle(payload);
    }
  });
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Runtime.addBinding', { name: '__sendToHost' });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: viewportWidth,
    height: viewportHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await cdp.send('Page.navigate', { url: `file://${join(pageDir, 'index.html')}` });
  await delay(2000);

  const rowCount = await waitFor(
    () => evaluate(`document.querySelectorAll('.commit-item').length || 0`),
    20000,
    'commit rows'
  );
  console.log(`commit rows: ${rowCount}`);

  const geometry = () =>
    evaluate(`(() => {
      const panels = [...document.querySelectorAll('[data-workbench-panel]')].map((el) => {
        const content = el.querySelector('.workbench-panel-content');
        const firstRow = el.querySelector('.file-change-row, .commit-detail-item, .empty-hint, .change-group');
        return {
          id: el.getAttribute('data-workbench-panel'),
          panelHeight: Math.round(el.getBoundingClientRect().height),
          contentHeight: content ? Math.round(content.getBoundingClientRect().height) : 0,
          contentScrollHeight: content ? content.scrollHeight : 0,
          visibleRows: el.querySelectorAll('.file-change-row').length,
          detailItems: el.querySelectorAll('.commit-detail-item').length,
          hintText: el.querySelector('.empty-hint')?.textContent ?? null,
          firstChildTop: firstRow ? Math.round(firstRow.getBoundingClientRect().top - el.getBoundingClientRect().top) : null,
          firstChildBottom: firstRow ? Math.round(firstRow.getBoundingClientRect().bottom - el.getBoundingClientRect().top) : null,
        };
      });
      const stack = document.querySelector('.workbench-panel-stack');
      return {
        stackHeight: stack ? Math.round(stack.getBoundingClientRect().height) : 0,
        stackScrollHeight: stack ? stack.scrollHeight : 0,
        panels,
      };
    })()`);

  console.log('before click:', JSON.stringify(await geometry(), null, 1));

  await evaluate(`document.querySelector('.commit-item').dispatchEvent(new MouseEvent('click', { bubbles: true }))`);
  await delay(1500);
  console.log('after click:', JSON.stringify(await geometry(), null, 1));

  if (dragFiles !== null) {
    const delta = Number(dragFiles);
    const result = await evaluate(`(() => {
      const panel = document.querySelector('[data-workbench-panel="files"]');
      const sash = panel.querySelector('.workbench-panel-sash');
      if (!sash) return { error: 'no sash on files panel' };
      const rect = sash.getBoundingClientRect();
      const startY = rect.top + 2;
      const pointer = (type, y) => sash.dispatchEvent(new PointerEvent(type, {
        bubbles: true, cancelable: true, clientX: rect.left + 10, clientY: y, pointerId: 1,
      }));
      pointer('pointerdown', startY);
      for (let step = 1; step <= 8; step += 1) {
        window.dispatchEvent(new PointerEvent('pointermove', {
          bubbles: true, clientY: startY + (${delta} * step) / 8, pointerId: 1,
        }));
      }
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
      return { startHeight: Math.round(panel.getBoundingClientRect().height) };
    })()`);
    await delay(300);
    const persisted = await evaluate(`JSON.stringify(window.__state?.workbenchLayout?.heights ?? null)`);
    console.log(`files sash drag by ${delta}px:`, JSON.stringify(result), 'persisted heights:', persisted);
    console.log('after drag:', JSON.stringify((await geometry()).panels.filter((p) => p.id === 'files'), null, 1));
  }

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: false,
  });
  await writeFile(screenshotPath, Buffer.from(shot.data, 'base64'));
  console.log('screenshot:', screenshotPath);
  console.log(
    'selection messages:',
    webviewMessages
      .filter((message) => message.type.startsWith('selectionDetails'))
      .map((message) => `${message.type}#${message.requestId}`)
      .join(', ')
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    host?.dispose();
    cdp?.socket.close();
    chrome?.kill();
    if (pageDir) await rm(pageDir, { recursive: true, force: true });
    if (profileDir) await rm(profileDir, { recursive: true, force: true });
  });
