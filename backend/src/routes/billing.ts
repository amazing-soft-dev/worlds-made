import type { FastifyPluginAsync } from 'fastify';
import { requireProfile } from '../auth/profile';
import type { Services } from '../container';
import { errors } from '../errors';
import { verifyStripeSignature } from '../adapters/stripe/billing';
import type { StripeEvent } from '../services/billing/billing';

export const billingRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  app.post('/billing/checkout', async (req) => {
    const { auth, profile } = await requireProfile(req, services.profiles);
    return services.billing.startCheckout(profile, auth.email);
  });

  app.post('/billing/portal', async (req) => {
    const { profile } = await requireProfile(req, services.profiles);
    return services.billing.portal(profile);
  });

  /** Called once after login: asks Stripe what it knows and fixes the plan if a webhook was missed. */
  app.post('/billing/sync', async (req) => {
    const { profile } = await requireProfile(req, services.profiles, { verified: false });
    return services.billing.sync(profile);
  });

  // The webhook needs the exact raw bytes to verify the signature, so it lives in its own scope with a raw-body parser.
  await app.register(async (hook) => {
    hook.addContentTypeParser('application/json', { parseAs: 'buffer' }, (_req, body, done) => done(null, body));

    hook.post('/webhooks/stripe', async (req, reply) => {
      const stripe = services.config.stripe;
      if (!stripe) throw errors.notFound();
      const raw = req.body as Buffer;
      if (!verifyStripeSignature(raw, req.headers['stripe-signature'] as string | undefined, stripe.webhookSecret)) {
        throw errors.badRequest('Invalid signature');
      }
      let event: StripeEvent;
      try {
        event = JSON.parse(raw.toString('utf8')) as StripeEvent;
      } catch {
        throw errors.badRequest('Invalid payload');
      }
      const result = await services.billing.handleEvent(event);
      return reply.code(200).send({ received: true, ...result });
    });
  });
};
