import { defineConfig } from 'vitest/config';

// Two projects, told apart by file name:
// - unit (*.test.ts): one class or function with in-memory fakes. Needs nothing running.
// - integration (*.int.test.ts): the real HTTP app against MongoDB, or an adapter against
//   LocalStack. Needs those services; the LocalStack tests skip themselves when it is down.
export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: ['tests/**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/**/*.int.test.ts'],
          // These files share one test database, so they must not run at the same time.
          fileParallelism: false,
        },
      },
    ],
  },
});
