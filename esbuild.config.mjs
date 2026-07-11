import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');
const isProd = process.env.NODE_ENV === 'production';

/** Extension host bundle (Node/CJS，external vscode) */
const extensionConfig = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'out/extension.js',
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['vscode'],
  sourcemap: !isProd,
  minify: isProd,
  logLevel: 'info',
};

/** Webview bundle (Browser/IIFE，含 React) */
const webviewConfig = {
  entryPoints: ['webview-ui/src/index.tsx'],
  bundle: true,
  outfile: 'out/webview/index.js',
  platform: 'browser',
  target: 'es2022',
  format: 'iife',
  jsx: 'automatic', // React 17+ 自动 JSX runtime，无需 import React
  sourcemap: !isProd,
  minify: isProd,
  loader: {
    '.css': 'css',
    '.ttf': 'file',
  },
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
  },
};

async function build() {
  if (isWatch) {
    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);
    await Promise.all([extCtx.watch(), webCtx.watch()]);
    console.log('[esbuild] watching...');
  } else {
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);
    console.log('[esbuild] build complete');
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
