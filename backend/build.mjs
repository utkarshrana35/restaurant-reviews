// Bundles the server into dist/server.js with esbuild for production (`pnpm start`), and the
// scheduled cleanup job into dist/delete-orphaned-reviews.js (`pnpm job:delete-orphaned-reviews`).
// Development does not use this: `pnpm dev` runs the TypeScript sources directly with tsx.
import { rm } from 'node:fs/promises';
import { build } from 'esbuild';

await rm('dist', { recursive: true, force: true });

await build({
  entryPoints: {
    server: 'src/server.ts',
    'delete-orphaned-reviews': 'scripts/orphanedReviews/deleteOrphanedReviews.ts',
  },
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  // Our own source is bundled; installed dependencies stay in node_modules and load at runtime.
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
