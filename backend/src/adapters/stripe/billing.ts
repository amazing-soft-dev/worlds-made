import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StripeSub {
  id: string;
  customer: string;
  status: string;
  /** Unix seconds. */
  currentPeriodEnd: number | null;
}

/** Hosted Checkout and the Customer Portal: card data never touches our servers. */
export interface BillingProvider {
  createCheckout(p: { userId: string; email: string | null; successUrl: string; cancelUrl: string }): Promise<{ url: string }>;
  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }>;
  /** Subscriptions tagged with our user id at checkout. Used to heal a missed webhook. */
  findByUser(userId: string): Promise<StripeSub[]>;
}

type FetchFn = typeof fetch;

/** Stripe over HTTPS with form encoding (no SDK). */
export class StripeClient implements BillingProvider {
  constructor(
    private readonly secretKey: string,
    private readonly priceId: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {}

  private async call<T>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
    const res = await this.fetchFn(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: { authorization: `Bearer ${this.secretKey}`, ...(form ? { 'content-type': 'application/x-www-form-urlencoded' } : {}) },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    if (!res.ok) throw new Error(`Stripe ${method} ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  createCheckout(p: { userId: string; email: string | null; successUrl: string; cancelUrl: string }): Promise<{ url: string }> {
    return this.call('POST', 'checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': this.priceId,
      'line_items[0][quantity]': '1',
      success_url: p.successUrl,
      cancel_url: p.cancelUrl,
      client_reference_id: p.userId,
      'subscription_data[metadata][userId]': p.userId,
      ...(p.email ? { customer_email: p.email } : {}),
    });
  }

  createPortal(customerId: string, returnUrl: string): Promise<{ url: string }> {
    return this.call('POST', 'billing_portal/sessions', { customer: customerId, return_url: returnUrl });
  }

  async findByUser(userId: string): Promise<StripeSub[]> {
    const q = encodeURIComponent(`metadata['userId']:'${userId.replace(/[^0-9a-f-]/gi, '')}'`);
    const body = await this.call<{ data: Array<{ id: string; customer: string; status: string; current_period_end?: number }> }>('GET', `subscriptions/search?query=${q}`);
    return body.data.map((s) => ({ id: s.id, customer: s.customer, status: s.status, currentPeriodEnd: s.current_period_end ?? null }));
  }
}

/** Stand-in for tests and keyless development. Tests set `subs` to simulate what Stripe knows. */
export class FakeBilling implements BillingProvider {
  checkouts: Array<{ userId: string; email: string | null }> = [];
  portals: string[] = [];
  subs = new Map<string, StripeSub[]>();

  async createCheckout(p: { userId: string; email: string | null }): Promise<{ url: string }> {
    this.checkouts.push({ userId: p.userId, email: p.email });
    return { url: `https://checkout.fake.example/session/${this.checkouts.length}` };
  }
  async createPortal(customerId: string): Promise<{ url: string }> {
    this.portals.push(customerId);
    return { url: `https://billing.fake.example/portal/${customerId}` };
  }
  async findByUser(userId: string): Promise<StripeSub[]> {
    return this.subs.get(userId) ?? [];
  }
}

/**
 * Verifies a Stripe-Signature header: `t=<unix>,v1=<hmac>` where the HMAC-SHA256 is over `<t>.<raw body>`.
 * The timestamp must be within the tolerance so a captured request cannot be replayed later.
 */
export function verifyStripeSignature(rawBody: Buffer | string, header: string | undefined, secret: string, nowSec: number = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.trim().split('='));
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v ?? '');
  if (!t || sigs.length === 0 || !/^\d+$/.test(t) || Math.abs(nowSec - Number(t)) > toleranceSec) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex'));
  return sigs.some((s) => {
    const given = Buffer.from(s);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
