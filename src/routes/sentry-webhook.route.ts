import { Hono } from 'hono';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import {
  normalizeSentryPayload,
  type SentryWebhookPayload,
} from '../schemas/sentry-webhook.schema.js';
import { buildAiContext } from '../normalizers/ai-context.normalizer.js';
import { dispatchToGithub } from '../services/github-dispatch.service.js';

const BODY_READ_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

export const sentryWebhookRoute = new Hono();

sentryWebhookRoute.post('/sentry', async (c) => {
  logger.info('Sentry webhook received', {
    contentType: c.req.header('content-type'),
    contentLength: c.req.header('content-length'),
    userAgent: c.req.header('user-agent'),
    sentryHookResource: c.req.header('sentry-hook-resource'),
  });

  const providedSecret =
    c.req.header('x-webhook-secret') ?? c.req.query('secret');
  if (providedSecret !== getEnv().SENTRY_WEBHOOK_SECRET) {
    logger.warn('Sentry webhook secret mismatch', {
      hasSecret: providedSecret !== undefined,
    });
    return c.json({ ok: false, message: 'Invalid webhook secret' }, 401);
  }

  let raw: string;
  try {
    raw = await withTimeout(c.req.text(), BODY_READ_TIMEOUT_MS, 'body-read');
  } catch (error) {
    logger.error('Failed to read Sentry webhook body', {
      error: error instanceof Error ? error.message : String(error),
    });
    return c.json({ ok: false, message: 'Failed to read request body' }, 408);
  }

  logger.info('Sentry webhook body', {
    length: raw.length,
    preview: raw.slice(0, 2000),
  });

  let body: SentryWebhookPayload;
  try {
    body = JSON.parse(raw) as SentryWebhookPayload;
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

  const aiContext = buildAiContext(body, issue);

  const result = await dispatchToGithub(issue, aiContext);
  if (!result.ok) {
    return c.json({ ok: false, message: 'Failed to dispatch to GitHub' }, 500);
  }

  return c.json({
    ok: true,
    dispatched: true,
    issueId: issue.issueId,
    eventId: issue.eventId,
    context: {
      hasStacktrace: aiContext.stacktrace.frames.length > 0,
      hasBreadcrumbs: aiContext.breadcrumbs.last_items.length > 0,
      hasTopInAppFrame: aiContext.stacktrace.top_in_app_frame !== undefined,
    },
  });
});
