import type { DataStore } from '../adapters/data/store';
import type { ChallengeScoreRow, GameRow, ProfileRow, StreakRow, SubscriptionRow } from '../db/tables';

const day = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * 24 * 3600 * 1000);

/** Deletes anonymous streaks and scores that have not been touched for `days`. Returns what was removed. */
export async function purgeAnonymous(store: DataStore, now: Date, days: number): Promise<{ streaks: number; scores: number }> {
  const cutoff = day(daysAgo(now, days));
  const streaks = (await store.list<StreakRow>('streaks', { where: { last_played_date: { lt: cutoff } } })).filter((s) => Boolean(s.anon_id));
  for (const s of streaks) await store.delete('streaks', { id: s.id });
  const scores = (await store.list<ChallengeScoreRow>('challenge_scores', { where: { date: { lt: cutoff } } })).filter((s) => Boolean(s.anon_id));
  for (const s of scores) await store.delete('challenge_scores', { id: s.id });
  return { streaks: streaks.length, scores: scores.length };
}

/**
 * Deletes accounts with no activity for `days` (no new game, build, score or streak day) and no active
 * subscription. Related rows cascade. The matching Supabase Auth user must be removed separately.
 */
export async function purgeInactiveAccounts(store: DataStore, now: Date, days: number): Promise<number> {
  const cutoff = daysAgo(now, days);
  const cutoffIso = cutoff.toISOString();
  const cutoffDay = day(cutoff);
  const old = await store.list<ProfileRow>('profiles', { where: { created_at: { lt: cutoffIso } } });
  let removed = 0;
  for (const p of old) {
    const active =
      (await store.count('games', { owner_id: p.id, created_at: { gte: cutoffIso } })) > 0 ||
      (await store.count('build_usage', { user_id: p.id, date: { gte: cutoffDay } })) > 0 ||
      (await store.count('streaks', { user_id: p.id, last_played_date: { gte: cutoffDay } })) > 0 ||
      (await store.count('challenge_scores', { user_id: p.id, created_at: { gte: cutoffIso } })) > 0;
    const sub = await store.get<SubscriptionRow>('subscriptions', { user_id: p.id });
    if (active || sub?.status === 'active') continue;
    // Cascades are the database's job; the memory fake needs them spelled out.
    for (const g of await store.list<GameRow>('games', { where: { owner_id: p.id } })) await store.delete('games', { id: g.id });
    await store.delete('profiles', { id: p.id });
    removed++;
  }
  return removed;
}
