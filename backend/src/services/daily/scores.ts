import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { LIMITS } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { ChallengeScoreRow, DailyChallengeRow, ProfileRow, StreakRow } from '../../db/tables';
import { AppError } from '../../errors';
import { addDays } from './daily';

/** A player is either a signed-in account or an anonymous id (under-13s and signed-out players only ever have the latter). */
export type Identity = { kind: 'user'; id: string } | { kind: 'anon'; id: string };

const column = (i: Identity) => (i.kind === 'user' ? 'user_id' : 'anon_id');
const DAY = (d: string) => new Date(`${d}T00:00:00Z`);

export interface BoardEntry {
  rank: number;
  /** Display name for accounts (a generated nickname under 18); anonymous players show as Guest. */
  name: string;
  score: number;
}

export interface StreakView {
  current: number;
  best: number;
}

export class DailyScoreService {
  /** Session ids already used this process. Best-score-wins keeps a replay on another instance harmless. */
  private readonly used = new Set<string>();

  constructor(
    private readonly store: DataStore,
    private readonly secret: string,
    private readonly opts: { minPlayMs: number; maxPlayMs: number } = { minPlayMs: 3000, maxPlayMs: 6 * 3600 * 1000 },
  ) {}

  private mac(date: string, who: Identity, nonce: string, started: number): string {
    return createHmac('sha256', `daily:${this.secret}`).update(`${date}|${who.kind}:${who.id}|${nonce}|${started}`).digest('base64url');
  }

  /** One token per play session. A score is accepted only with the token its play started with. */
  startSession(date: string, who: Identity, nowMs: number = Date.now()): string {
    const nonce = randomBytes(9).toString('base64url');
    return [date, nonce, nowMs, this.mac(date, who, nonce, nowMs)].join('~');
  }

  private verify(token: string, date: string, who: Identity, nowMs: number): string {
    const [tDate, nonce, startedRaw, sig] = token.split('~');
    const started = Number(startedRaw);
    if (!tDate || !nonce || !sig || !Number.isFinite(started) || tDate !== date) {
      throw new AppError(403, 'invalid_session', 'This play session is not valid for today\'s challenge. Start again.');
    }
    const expected = Buffer.from(this.mac(date, who, nonce, started));
    const given = Buffer.from(sig);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new AppError(403, 'invalid_session', 'This play session is not valid. Start again.');
    }
    const elapsed = nowMs - started;
    if (elapsed < this.opts.minPlayMs) throw new AppError(400, 'too_fast', 'That finished too quickly to be a real play.');
    if (elapsed > this.opts.maxPlayMs) throw new AppError(400, 'session_expired', 'This play session has expired. Start again.');
    return nonce;
  }

  async submit(p: {
    challenge: DailyChallengeRow;
    who: Identity;
    token: string;
    value: number;
    nowMs?: number;
  }): Promise<{ score: number; best: number; rank: number; streak: StreakView }> {
    const nowMs = p.nowMs ?? Date.now();
    const date = p.challenge.date as string;
    const nonce = this.verify(p.token, date, p.who, nowMs);
    if (this.used.has(nonce)) throw new AppError(409, 'already_submitted', 'This play already has a score.');

    // Scores outside a sane range for that game are rejected. (No prizes in V1: browser scores can be faked.)
    const score = Math.round(p.value);
    if (!Number.isFinite(p.value) || score < Number(p.challenge.score_min) || score > Number(p.challenge.score_max)) {
      throw new AppError(400, 'score_out_of_range', 'That score is not possible for this game.');
    }
    this.used.add(nonce);

    const where = { date, [column(p.who)]: p.who.id };
    const existing = await this.store.get<ChallengeScoreRow>('challenge_scores', where);
    let best = score;
    if (!existing) {
      await this.store.insert<ChallengeScoreRow>('challenge_scores', { date, [column(p.who)]: p.who.id, score });
    } else if (score > Number(existing.score)) {
      await this.store.update<ChallengeScoreRow>('challenge_scores', { id: existing.id }, { score });
    } else {
      best = Number(existing.score);
    }

    const streak = await this.recordPlay(p.who, date);
    const rank = (await this.store.count('challenge_scores', { date, score: { gt: best } })) + 1;
    return { score, best, rank, streak };
  }

  /** A streak counts consecutive days with a finished game, per account or anonymous id. */
  async recordPlay(who: Identity, date: string): Promise<StreakView> {
    const where = { [column(who)]: who.id };
    const row = await this.store.get<StreakRow>('streaks', where);
    if (!row) {
      await this.store.insert<StreakRow>('streaks', { ...where, current: 1, best: 1, last_played_date: date });
      return { current: 1, best: 1 };
    }
    if (row.last_played_date === date) return { current: row.current, best: row.best };
    const yesterday = addDays(DAY(date), -1).toISOString().slice(0, 10);
    const current = row.last_played_date === yesterday ? row.current + 1 : 1;
    const best = Math.max(row.best, current);
    await this.store.update<StreakRow>('streaks', { id: row.id }, { current, best, last_played_date: date });
    return { current, best };
  }

  /** The streak as it stands today: a streak last extended before yesterday has already ended. */
  async streakFor(who: Identity, today: string): Promise<StreakView> {
    const row = await this.store.get<StreakRow>('streaks', { [column(who)]: who.id });
    if (!row) return { current: 0, best: 0 };
    const yesterday = addDays(DAY(today), -1).toISOString().slice(0, 10);
    const alive = row.last_played_date === today || row.last_played_date === yesterday;
    return { current: alive ? row.current : 0, best: row.best };
  }

  async mine(who: Identity, date: string): Promise<{ best: number | null; rank: number | null; streak: StreakView }> {
    const row = await this.store.get<ChallengeScoreRow>('challenge_scores', { date, [column(who)]: who.id });
    const rank = row ? (await this.store.count('challenge_scores', { date, score: { gt: row.score } })) + 1 : null;
    return { best: row ? Number(row.score) : null, rank, streak: await this.streakFor(who, date) };
  }

  /** Top 100 for a day. Display names only. */
  async leaderboard(date: string): Promise<BoardEntry[]> {
    const rows = await this.store.list<ChallengeScoreRow>('challenge_scores', { where: { date }, orderBy: 'score', desc: true, limit: LIMITS.leaderboardSize });
    const ids = rows.map((r) => r.user_id).filter((x): x is string => Boolean(x));
    const profiles = ids.length ? await this.store.list<ProfileRow>('profiles', { where: { id: { in: ids } } }) : [];
    const names = new Map(profiles.map((p) => [p.id, p.display_name]));
    return rows.map((r, i) => ({ rank: i + 1, name: (r.user_id && names.get(r.user_id)) || 'Guest', score: Number(r.score) }));
  }
}
