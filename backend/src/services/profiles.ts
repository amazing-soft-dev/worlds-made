import type { AgeBand } from '@worlds-made/shared';
import type { DataStore } from '../adapters/data/store';
import type { ProfileRow } from '../db/tables';
import { errors } from '../errors';

export interface NewProfile {
  id: string;
  displayName: string;
  birthYear: number;
  ageBand: AgeBand;
  country: string | null;
}

export class ProfileService {
  constructor(private readonly store: DataStore) {}

  get(id: string): Promise<ProfileRow | null> {
    return this.store.get<ProfileRow>('profiles', { id });
  }

  /** Creates the profile once. The age answer is never changed afterwards. */
  async create(input: NewProfile): Promise<ProfileRow> {
    if (await this.get(input.id)) throw errors.conflict('Profile already exists');
    return this.store.insert<ProfileRow>('profiles', {
      id: input.id,
      display_name: input.displayName,
      birth_year: input.birthYear,
      age_band: input.ageBand,
      country: input.country,
      plan: 'free',
    });
  }

  async setDisplayName(id: string, displayName: string): Promise<ProfileRow> {
    const [row] = await this.store.update<ProfileRow>('profiles', { id }, { display_name: displayName });
    if (!row) throw errors.notFound('Profile not found');
    return row;
  }
}
