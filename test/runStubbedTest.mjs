/**
 * Bundles a TypeScript test entry with the `vscode` module aliased to
 * `test/stubs/vscode.mjs`, then runs it in Node.
 */
import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { build } from 'esbuild';

const entryPoint = process.argv[2];
if (!entryPoint) throw new Error('TS test entry path is required');

const vscodeStub = resolve(import.meta.dirname, 'stubs/vscode.mjs');
const outfile = join(tmpdir(), `${basename(entryPoint)}-${process.pid}.cjs`);

try {
  await build({
    entryPoints: [entryPoint],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    jsx: 'automatic',
    outfile,
    logLevel: 'silent',
    alias: { vscode: vscodeStub },
  });
  createRequire(import.meta.url)(outfile);
} finally {
  await rm(outfile, { force: true });
}
