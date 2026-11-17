import { LIMITS } from '@worlds-made/shared';
import type { GameVersionRow, ProfileRow } from '../../db/tables';
import type { DataStore } from '../../adapters/data/store';
import type { BuildResult, GameBuilder } from './builder';
import type { Genre } from './templates';
import type { UsageService } from './usage';

export type Charge = 'build' | 'free-repair';
export type Charged = BuildResult & { charged: Charge };

/**
 * What a player's request costs. The user is charged only after a build succeeds, so failures and timeouts are free.
 */
export class BuildWorkflow {
  constructor(
    private readonly builder: GameBuilder,
    private readonly usage: UsageService,
    private readonly store: DataStore,
  ) {}

  private run<T>(_profile: ProfileRow, fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  generate(profile: ProfileRow, input: { prompt: string; genre?: Genre }): Promise<Charged> {
    return this.run(profile, async () => {
      await this.usage.assertCanBuild(profile);
      const result = await this.builder.build({ userId: profile.id, kind: 'generate', prompt: input.prompt, genre: input.genre });
      await this.usage.recordBuild(profile.id);
      return { ...result, charged: 'build' as const };
    });
  }

  /** Counts the repair versions made since the last real build of this game. */
  async repairsSinceBuild(gameId: string): Promise<number> {
    const versions = await this.store.list<GameVersionRow>('game_versions', { where: { game_id: gameId }, orderBy: 'created_at', desc: true });
    let n = 0;
    for (const v of versions) {
      if (!v.prompt.startsWith('repair:')) break;
      n++;
    }
    return n;
  }

  /** Two free repairs per build; after that a repair counts as a build. */
  repair(profile: ProfileRow, gameId: string, errors: string[]): Promise<Charged> {
    return this.run(profile, async () => {
      const free = (await this.repairsSinceBuild(gameId)) < LIMITS.freeRepairsPerBuild;
      if (!free) await this.usage.assertCanBuild(profile);
      const result = await this.builder.build({ userId: profile.id, kind: 'repair', prompt: '', gameId, errors });
      if (free) await this.usage.recordRepair(profile.id);
      else await this.usage.recordBuild(profile.id);
      return { ...result, charged: free ? ('free-repair' as const) : ('build' as const) };
    });
  }

  /** "Change it" is a player-directed rewrite, so it always counts as a build. */
  change(profile: ProfileRow, gameId: string, instruction: string): Promise<Charged> {
    return this.run(profile, async () => {
      await this.usage.assertCanBuild(profile);
      const result = await this.builder.build({ userId: profile.id, kind: 'change', prompt: instruction, gameId });
      await this.usage.recordBuild(profile.id);
      return { ...result, charged: 'build' as const };
    });
  }
}
