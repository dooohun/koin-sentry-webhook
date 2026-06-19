import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export async function postIssueComment(issueId: string, text: string): Promise<void> {
  const env = getEnv();

  if (!env.SENTRY_API_TOKEN) {
    logger.warn('SENTRY_API_TOKEN not set, skipping Sentry comment', { issueId });
    return;
  }

  const url = `${env.SENTRY_API_BASE_URL}/api/0/issues/${issueId}/comments/`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.SENTRY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.warn('Sentry comment API returned error', { issueId, status: res.status, body });
      return;
    }

    logger.info('Sentry comment posted', { issueId });
  } catch (err) {
    logger.warn('Failed to post Sentry comment', {
      issueId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
