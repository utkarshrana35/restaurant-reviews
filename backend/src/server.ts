import { buildContainer } from './container';
import { createApp } from './infrastructure/adapters/inbound/http/createApp';
import { loadEnv } from './infrastructure/config/env';

async function main(): Promise<void> {
  const env = loadEnv();
  const { database, http } = buildContainer(env);

  await database.connect();

  const server = createApp(http).listen(env.PORT, (err) => {
    // Express passes a bind failure (for example the port being in use) to this callback.
    if (err) throw err;
    console.log(`API listening on http://127.0.0.1:${env.PORT}`);
  });

  const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down`);
    // close() stops new connections and calls back once in-flight requests have finished.
    server.close(() => {
      void database.disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
