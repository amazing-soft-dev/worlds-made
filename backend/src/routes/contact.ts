import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { oneLine } from '../adapters/mail/mailer';
import type { Services } from '../container';
import { enforce } from '../lib/rate-limit';

/**
 * The contact form. A hidden "website" field catches bots (the real form leaves it empty) and the answer looks the
 * same either way. At most 5 messages an hour per IP.
 */
export const contactRoutes = (services: Services): FastifyPluginAsync => async (app) => {
  app.post('/contact', async (req, reply) => {
    const body = z
      .object({
        name: z.string().trim().min(1).max(80),
        email: z.string().trim().email().max(200),
        message: z.string().trim().min(10).max(2000),
        website: z.string().max(200).optional(),
      })
      .parse(req.body);

    if (body.website) return reply.code(202).send({ ok: true }); // honeypot: pretend it worked

    enforce(services.limiter, reply, `contact:${req.ip}`, 5, 3600_000, 'You have sent a few messages already. Please try again later.');
    await services.mailer.send({
      to: services.config.mailTo,
      subject: `Contact from ${oneLine(body.name)}`,
      replyTo: body.email,
      text: `From: ${oneLine(body.name)} <${body.email}>\n\n${body.message}\n`,
    });
    return reply.code(202).send({ ok: true });
  });
};
