import type { TableName } from '../../db/tables';

export type Scalar = string | number | boolean | null;

/** A plain value means "equals". Operators combine with AND. */
export type Condition =
  | Scalar
  | { eq?: Scalar; neq?: Scalar; gt?: number | string; gte?: number | string; lt?: number | string; lte?: number | string; in?: Scalar[] };

export type Where = Record<string, Condition>;
export type Row = Record<string, unknown>;

export interface ListOptions {
  where?: Where;
  orderBy?: string;
  desc?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * The only way services touch the database. Two implementations: an in-memory fake (tests, CI, local dev)
 * and Supabase over PostgREST (production). Services never import either directly.
 */
export interface DataStore {
  insert<T extends object = Row>(table: TableName, row: Partial<T>): Promise<T>;
  /** Insert, or update the existing row that has the same values for `conflict` columns. */
  upsert<T extends object = Row>(table: TableName, row: Partial<T>, conflict: string[]): Promise<T>;
  get<T extends object = Row>(table: TableName, where: Where): Promise<T | null>;
  list<T extends object = Row>(table: TableName, opts?: ListOptions): Promise<T[]>;
  update<T extends object = Row>(table: TableName, where: Where, patch: Partial<T>): Promise<T[]>;
  delete(table: TableName, where: Where): Promise<number>;
  count(table: TableName, where?: Where): Promise<number>;
}

/** Large text blobs (generated game HTML). Memory/disk fake and Supabase Storage implementations. */
export interface BlobStore {
  put(path: string, body: string, contentType?: string): Promise<void>;
  get(path: string): Promise<string | null>;
  remove(path: string): Promise<void>;
}

export function isOperator(c: Condition): c is Exclude<Condition, Scalar> {
  return typeof c === 'object' && c !== null;
}
