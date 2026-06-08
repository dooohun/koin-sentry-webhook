import { Hono } from 'hono';
import { logger } from './utils/logger.js';
import { sentryWebhookRoute } from './routes/sentry-webhook.route.js';

export const app = new Hono();

app.get('/health', (c) => {
  return c.json({ ok: true });
});

app.route('/webhooks', sentryWebhookRoute);

app.onError((err, c) => {
  logger.error('Unhandled error', {
    path: c.req.path,
    method: c.req.method,
    error: err instanceof Error ? err.message : String(err),
  });

  return c.json({ ok: false, message: 'Internal Server Error' }, 500);
});

app.notFound((c) => {
  return c.json({ ok: false, message: 'Not Found' }, 404);
});
