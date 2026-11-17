import type { TableName } from '../../db/tables';
import { isOperator, type BlobStore, type DataStore, type ListOptions, type Row, type Scalar, type Where } from './store';

type FetchFn = typeof fetch;

const enc = (v: Scalar) => (v === null ? 'null' : encodeURIComponent(String(v)));

/** Builds PostgREST filter query parameters from a Where. Exported for tests. */
export function toFilters(where: Where | undefined): string[] {
  const out: string[] = [];
  for (const [col, cond] of Object.entries(where ?? {})) {
    if (!isOperator(cond)) {
      out.push(`${col}=${cond === null ? 'is.null' : `eq.${enc(cond)}`}`);
      continue;
    }
    if (cond.eq !== undefined) out.push(`${col}=eq.${enc(cond.eq)}`);
    if (cond.neq !== undefined) out.push(`${col}=neq.${enc(cond.neq)}`);
    for (const op of ['gt', 'gte', 'lt', 'lte'] as const) {
      const v = cond[op];
      if (v !== undefined) out.push(`${col}=${op}.${enc(v)}`);
    }
    if (cond.in !== undefined) out.push(`${col}=in.(${cond.in.map((v) => (v === null ? 'null' : `"${String(v).replace(/"/g, '\\"')}"`)).join(',')})`);
  }
  return out;
}

/** DataStore over Supabase's PostgREST API using the service-role key. */
export class SupabaseStore implements DataStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}`, 'content-type': 'application/json', ...extra };
  }

  private async request(table: TableName, query: string[], init: RequestInit & { headers?: Record<string, string> }): Promise<Response> {
    const qs = query.length ? `?${query.join('&')}` : '';
    const res = await this.fetchFn(`${this.url}/rest/v1/${table}${qs}`, { ...init, headers: this.headers(init.headers) });
    if (!res.ok) throw new Error(`Supabase ${init.method ?? 'GET'} ${table} failed: ${res.status} ${await res.text()}`);
    return res;
  }

  async insert<T extends object = Row>(table: TableName, row: Partial<T>): Promise<T> {
    const res = await this.request(table, [], { method: 'POST', body: JSON.stringify(row), headers: { prefer: 'return=representation' } });
    return ((await res.json()) as T[])[0] as T;
  }

  async upsert<T extends object = Row>(table: TableName, row: Partial<T>, conflict: string[]): Promise<T> {
    const res = await this.request(table, [`on_conflict=${conflict.join(',')}`], {
      method: 'POST',
      body: JSON.stringify(row),
      headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    });
    return ((await res.json()) as T[])[0] as T;
  }

  async get<T extends object = Row>(table: TableName, where: Where): Promise<T | null> {
    const rows = await this.list<T>(table, { where, limit: 1 });
    return rows[0] ?? null;
  }

  async list<T extends object = Row>(table: TableName, opts: ListOptions = {}): Promise<T[]> {
    const q = toFilters(opts.where);
    if (opts.orderBy) q.push(`order=${opts.orderBy}.${opts.desc ? 'desc' : 'asc'}`);
    if (opts.limit !== undefined) q.push(`limit=${opts.limit}`);
    if (opts.offset !== undefined) q.push(`offset=${opts.offset}`);
    const res = await this.request(table, q, { method: 'GET' });
    return (await res.json()) as T[];
  }

  async update<T extends object = Row>(table: TableName, where: Where, patch: Partial<T>): Promise<T[]> {
    const res = await this.request(table, toFilters(where), { method: 'PATCH', body: JSON.stringify(patch), headers: { prefer: 'return=representation' } });
    return (await res.json()) as T[];
  }

  async delete(table: TableName, where: Where): Promise<number> {
    const res = await this.request(table, toFilters(where), { method: 'DELETE', headers: { prefer: 'return=representation' } });
    return ((await res.json()) as unknown[]).length;
  }

  async count(table: TableName, where?: Where): Promise<number> {
    const res = await this.request(table, [...toFilters(where), 'select=*', 'limit=1'], { method: 'GET', headers: { prefer: 'count=exact' } });
    const range = res.headers.get('content-range') ?? '';
    return Number(range.split('/')[1] ?? 0);
  }
}

/** BlobStore over Supabase Storage (one private bucket). */
export class SupabaseBlobStore implements BlobStore {
  constructor(
    private readonly url: string,
    private readonly serviceKey: string,
    private readonly bucket = 'games',
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private object(path: string): string {
    return `${this.url}/storage/v1/object/${this.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  private auth(): Record<string, string> {
    return { apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}` };
  }

  async put(path: string, body: string, contentType = 'text/html; charset=utf-8'): Promise<void> {
    const res = await this.fetchFn(this.object(path), { method: 'POST', headers: { ...this.auth(), 'content-type': contentType, 'x-upsert': 'true' }, body });
    if (!res.ok) throw new Error(`Storage put ${path} failed: ${res.status} ${await res.text()}`);
  }

  async get(path: string): Promise<string | null> {
    const res = await this.fetchFn(this.object(path), { headers: this.auth() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`Storage get ${path} failed: ${res.status}`);
    return res.text();
  }

  async remove(path: string): Promise<void> {
    const res = await this.fetchFn(this.object(path), { method: 'DELETE', headers: this.auth() });
    if (!res.ok && res.status !== 404) throw new Error(`Storage remove ${path} failed: ${res.status}`);
  }
}
