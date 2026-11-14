import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: 'esm',
  dts: {
    // tsup's declaration build sets `baseUrl` internally, which TypeScript 6 reports as
    // deprecated and treats as an error. This acknowledges it for that step only.
    compilerOptions: { ignoreDeprecations: '6.0' },
  },
  sourcemap: true,
  // Not in watch mode: the apps are already running against dist and must not find it missing.
  clean: !options.watch,
}));
