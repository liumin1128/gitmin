import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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
  });
  createRequire(import.meta.url)(outfile);
} finally {
  await rm(outfile, { force: true });
}
