import type { Config } from '../../config';
import { MemoryBlobStore, MemoryStore } from './memory';
import type { BlobStore, DataStore } from './store';
import { SupabaseBlobStore, SupabaseStore } from './supabase';

export * from './store';
export { MemoryBlobStore, MemoryStore } from './memory';

/** Supabase when its keys are configured, otherwise the in-memory fakes. */
export function createStores(config: Config): { store: DataStore; blobs: BlobStore; mode: 'supabase' | 'memory' } {
  if (config.supabase) {
    return {
      store: new SupabaseStore(config.supabase.url, config.supabase.serviceKey),
      blobs: new SupabaseBlobStore(config.supabase.url, config.supabase.serviceKey),
      mode: 'supabase',
    };
  }
  return { store: new MemoryStore(), blobs: new MemoryBlobStore(), mode: 'memory' };
}
