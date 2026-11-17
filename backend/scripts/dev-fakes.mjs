// Runs the backend on the in-memory fakes, even if your shell has real API keys set.
//   npm run dev:fakes -w backend
// A real OPENAI_API_KEY, SUPABASE_URL, STRIPE_* and so on would make the server call live services. This script
// starts it with those variables removed, reading the rest (SITE_URL, GAME_ORIGIN, COOKIE_SECRET ...) from backend/.env.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('..', import.meta.url));
const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (/^(SUPABASE|STRIPE|OPENAI|RAWG|RESEND|LLM|AUTH_DEV|AFFILIATE|MODERATION|SENTRY)/.test(key)) delete env[key];
}

const args = [];
if (existsSync(`${dir}.env`)) args.push('--env-file=.env');
args.push('--import', 'tsx', 'src/server.ts');

console.log('Starting the backend on fakes (no live services).');
const child = spawn(process.execPath, args, { cwd: dir, env, stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig));
