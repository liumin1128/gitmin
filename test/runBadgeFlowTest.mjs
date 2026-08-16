/**
 * Test runner that bundles a test entry with esbuild while aliasing the
 * "vscode" module to the local mock, then executes it in Node.
 */
import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { build } from 'esbuild';

const entryPoint = process.argv[2];
if (!entryPoint) throw new Error('TSX test entry path is required');
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
    plugins: [
      {
        name: 'vscode-mock-alias',
        setup(build) {
          build.onResolve({ filter: /^vscode$/ }, () => ({
            path: resolve(process.cwd(), 'test', 'vscodeMock.ts'),
          }));
        },
      },
    ],
  });
  createRequire(import.meta.url)(outfile);
} finally {
  await rm(outfile, { force: true });
}
