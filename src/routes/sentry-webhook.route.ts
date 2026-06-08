import { Hono } from 'hono';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import {
  normalizeSentryPayload,
  type SentryWebhookPayload,
} from '../schemas/sentry-webhook.schema.js';
import { dispatchToGithub } from '../services/github-dispatch.service.js';

export const sentryWebhookRoute = new Hono();

sentryWebhookRoute.post('/sentry', async (c) => {
  logger.info('Sentry webhook received');

  const providedSecret = c.req.header('x-webhook-secret');
  if (providedSecret !== getEnv().SENTRY_WEBHOOK_SECRET) {
    logger.warn('Sentry webhook secret mismatch', {
      hasHeader: providedSecret !== undefined,
    });
    return c.json({ ok: false, message: 'Invalid webhook secret' }, 401);
  }

  let body: SentryWebhookPayload;
  try {
    body = await c.req.json<SentryWebhookPayload>();
  } catch (error) {
    logger.error('Failed to parse Sentry webhook payload', {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ ok: false, message: 'Invalid JSON payload' }, 400);
  }

  const issue = normalizeSentryPayload(body);
  logger.info('Extracted Sentry issue', {
    issueId: issue.issueId,
    title: issue.title,
  });

  if (!issue.issueId) {
    logger.warn('Missing issueId in Sentry payload');
    return c.json({ ok: false, message: 'Missing issueId in payload' }, 400);
  }

  const result = await dispatchToGithub(issue);
  if (!result.ok) {
    return c.json({ ok: false, message: 'Failed to dispatch to GitHub' }, 500);
  }

  return c.json({
    ok: true,
    dispatched: true,
    issueId: issue.issueId,
  });
});
