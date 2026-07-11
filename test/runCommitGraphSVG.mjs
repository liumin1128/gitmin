import { createRequire } from 'node:module';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';

const outfile = join(tmpdir(), `git-managment-commit-graph-${process.pid}.cjs`);

try {
  await build({
    entryPoints: ['test/commitGraphSVG.tsx'],
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
