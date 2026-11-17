import { buildApp } from './app';
import { assertProductionReady, loadConfig } from './config';

const config = loadConfig();
assertProductionReady(config);
const app = buildApp({ logger: true, config });

app.listen({ port: config.port, host: '127.0.0.1' }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
