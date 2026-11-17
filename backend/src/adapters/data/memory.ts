import { randomUUID } from 'node:crypto';
import { CREATED_AT_TABLES, TABLES, UUID_ID_TABLES, type TableName } from '../../db/tables';
import { isOperator, type BlobStore, type Condition, type DataStore, type ListOptions, type Row, type Where } from './store';

function isSet<T>(v: T | null | undefined): v is T {
  return v !== null && v !== undefined;
}

function matches(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  return Object.entries(where).every(([col, cond]) => matchesOne(row[col], cond));
}

function matchesOne(value: unknown, cond: Condition): boolean {
  if (!isOperator(cond)) return value === cond || (value === undefined && cond === null);
  const v = value as string | number | null | undefined;
  if (cond.eq !== undefined && v !== cond.eq) return false;
  if (cond.neq !== undefined && v === cond.neq) return false;
  if (cond.gt !== undefined && !(isSet(v) && v > cond.gt)) return false;
  if (cond.gte !== undefined && !(isSet(v) && v >= cond.gte)) return false;
  if (cond.lt !== undefined && !(isSet(v) && v < cond.lt)) return false;
  if (cond.lte !== undefined && !(isSet(v) && v <= cond.lte)) return false;
  if (cond.in !== undefined && !cond.in.includes(v as never)) return false;
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (!isSet(a)) return -1;
  if (!isSet(b)) return 1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}

/** In-memory DataStore: the fake used by tests, CI and keyless local development. */
export class MemoryStore implements DataStore {
  private readonly tables = new Map<TableName, Row[]>(TABLES.map((t) => [t, []]));

  private rows(table: TableName): Row[] {
    const rows = this.tables.get(table);
    if (!rows) throw new Error(`Unknown table ${table}`);
    return rows;
  }

  async insert<T extends object = Row>(table: TableName, row: Partial<T>): Promise<T> {
    const full = { ...row } as unknown as Row;
    if (UUID_ID_TABLES.has(table) && full.id === undefined) full.id = randomUUID();
    if (CREATED_AT_TABLES.has(table) && full.created_at === undefined) full.created_at = new Date().toISOString();
    this.rows(table).push(full);
    return structuredClone(full) as T;
  }

  async upsert<T extends object = Row>(table: TableName, row: Partial<T>, conflict: string[]): Promise<T> {
    const existing = this.rows(table).find((r) => conflict.every((c) => r[c] === (row as unknown as Row)[c]));
    if (!existing) return this.insert<T>(table, row);
    Object.assign(existing, row);
    return structuredClone(existing) as T;
  }

  async get<T extends object = Row>(table: TableName, where: Where): Promise<T | null> {
    const found = this.rows(table).find((r) => matches(r, where));
    return found ? (structuredClone(found) as T) : null;
  }

  async list<T extends object = Row>(table: TableName, opts: ListOptions = {}): Promise<T[]> {
    let out = this.rows(table).filter((r) => matches(r, opts.where));
    if (opts.orderBy) {
      const col = opts.orderBy;
      // Sort ascending (stable), then reverse for desc, so rows with equal values come back newest-inserted first.
      out = [...out].sort((a, b) => compare(a[col], b[col]));
      if (opts.desc) out.reverse();
    }
    const start = opts.offset ?? 0;
    out = out.slice(start, opts.limit === undefined ? undefined : start + opts.limit);
    return out.map((r) => structuredClone(r) as T);
  }

  async update<T extends object = Row>(table: TableName, where: Where, patch: Partial<T>): Promise<T[]> {
    const hit = this.rows(table).filter((r) => matches(r, where));
    for (const r of hit) Object.assign(r, patch);
    return hit.map((r) => structuredClone(r) as T);
  }

  async delete(table: TableName, where: Where): Promise<number> {
    const rows = this.rows(table);
    const keep = rows.filter((r) => !matches(r, where));
    const removed = rows.length - keep.length;
    this.tables.set(table, keep);
    return removed;
  }

  async count(table: TableName, where?: Where): Promise<number> {
    return this.rows(table).filter((r) => matches(r, where)).length;
  }
}

/** In-memory BlobStore. */
export class MemoryBlobStore implements BlobStore {
  private readonly blobs = new Map<string, string>();
  async put(path: string, body: string): Promise<void> {
    this.blobs.set(path, body);
  }
  async get(path: string): Promise<string | null> {
    return this.blobs.get(path) ?? null;
  }
  async remove(path: string): Promise<void> {
    this.blobs.delete(path);
  }
}
