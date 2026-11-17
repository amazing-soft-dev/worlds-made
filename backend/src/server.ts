import { buildApp } from './app';

const port = Number(process.env.PORT ?? 4000);
const app = buildApp({ logger: true });

app.listen({ port, host: '127.0.0.1' }).catch((err: unknown) => {
  app.log.error(err);
  process.exit(1);
});
