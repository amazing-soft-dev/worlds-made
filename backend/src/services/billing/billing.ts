import type { Plan } from '@worlds-made/shared';
import type { DataStore } from '../../adapters/data/store';
import type { BillingProvider, StripeSub } from '../../adapters/stripe/billing';
import type { ProfileRow, SubscriptionRow } from '../../db/tables';
import { AppError, errors } from '../../errors';

const ENTITLED = new Set(['active', 'trialing']);

export interface StripeEvent {
  id?: string;
  type: string;
  data: { object: Record<string, unknown> };
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/**
 * Subscriptions. The Stripe webhook is the only writer of the `subscriptions` table, and the paid plan is derived
 * from it: active or trialing means paid, anything else means free. Handlers are idempotent, so Stripe's retries are safe.
 */
export class BillingService {
  constructor(
    private readonly store: DataStore,
    private readonly provider: BillingProvider | null,
    private readonly urls: { site: string },
  ) {}

  private need(): BillingProvider {
    if (!this.provider) throw new AppError(503, 'billing_unavailable', 'Payments are not available right now.');
    return this.provider;
  }

  async subscription(userId: string): Promise<SubscriptionRow | null> {
    return this.store.get<SubscriptionRow>('subscriptions', { user_id: userId });
  }

  /** Adults only: a teen is told to ask a parent to sign up with their own account. */
  async startCheckout(profile: ProfileRow, email: string | null): Promise<{ url: string }> {
    const provider = this.need();
    if (profile.age_band !== 'adult') {
      throw new AppError(403, 'ask_a_parent', 'The paid plan is for adults. Ask a parent to sign up on their own account.');
    }
    const existing = await this.subscription(profile.id);
    if (existing && ENTITLED.has(existing.status)) throw errors.conflict('You already have the paid plan');
    return provider.createCheckout({
      userId: profile.id,
      email,
      successUrl: `${this.urls.site}/account?billing=success`,
      cancelUrl: `${this.urls.site}/pricing?billing=cancelled`,
    });
  }

  async portal(profile: ProfileRow): Promise<{ url: string }> {
    const provider = this.need();
    const sub = await this.subscription(profile.id);
    if (!sub) throw errors.notFound('There is no subscription to manage');
    return provider.createPortal(sub.stripe_customer_id, `${this.urls.site}/account`);
  }

  /** Writes the subscription row and sets the plan from the status. The only place either is written. */
  private async apply(userId: string, customer: string, status: string, periodEndSec: number | null): Promise<Plan> {
    const plan: Plan = ENTITLED.has(status) ? 'paid' : 'free';
    await this.store.upsert<SubscriptionRow>(
      'subscriptions',
      { user_id: userId, stripe_customer_id: customer, status, current_period_end: periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null },
      ['user_id'],
    );
    await this.store.update<ProfileRow>('profiles', { id: userId }, { plan });
    return plan;
  }

  private async userFor(obj: Record<string, unknown>): Promise<string | null> {
    const meta = obj.metadata as Record<string, unknown> | undefined;
    const fromMeta = str(meta?.userId) ?? str(obj.client_reference_id);
    if (fromMeta) return fromMeta;
    const customer = str(obj.customer);
    return customer ? ((await this.store.get<SubscriptionRow>('subscriptions', { stripe_customer_id: customer }))?.user_id ?? null) : null;
  }

  /** Handles a verified webhook event. Unknown event types are acknowledged and ignored. */
  async handleEvent(event: StripeEvent): Promise<{ handled: boolean }> {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = str(obj.client_reference_id);
        const customer = str(obj.customer);
        if (!userId || !customer) return { handled: false };
        await this.apply(userId, customer, 'active', null);
        return { handled: true };
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const userId = await this.userFor(obj);
        const customer = str(obj.customer);
        if (!userId || !customer) return { handled: false };
        const status = event.type === 'customer.subscription.deleted' ? 'canceled' : (str(obj.status) ?? 'incomplete');
        await this.apply(userId, customer, status, num(obj.current_period_end));
        return { handled: true };
      }
      case 'invoice.payment_failed': {
        const customer = str(obj.customer);
        const row = customer ? await this.store.get<SubscriptionRow>('subscriptions', { stripe_customer_id: customer }) : null;
        if (!row) return { handled: false };
        await this.apply(row.user_id, row.stripe_customer_id, 'past_due', null);
        return { handled: true };
      }
      default:
        return { handled: false };
    }
  }

  /**
   * Re-syncs from Stripe on login, so a missed webhook heals itself. Picks the best subscription Stripe knows for
   * this user (entitled first, then the latest) and applies it.
   */
  async sync(profile: ProfileRow): Promise<{ plan: Plan; status: string | null }> {
    if (!this.provider) return { plan: profile.plan, status: null };
    const subs: StripeSub[] = await this.provider.findByUser(profile.id);
    const best = subs.find((s) => ENTITLED.has(s.status)) ?? [...subs].sort((a, b) => (b.currentPeriodEnd ?? 0) - (a.currentPeriodEnd ?? 0))[0];
    if (!best) {
      const row = await this.subscription(profile.id);
      return { plan: profile.plan, status: row?.status ?? null };
    }
    const plan = await this.apply(profile.id, best.customer, best.status, best.currentPeriodEnd);
    return { plan, status: best.status };
  }
}
