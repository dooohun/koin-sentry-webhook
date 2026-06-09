import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import type { AiDebugContext } from '../schemas/ai-debug-context.schema.js';
import type { NormalizedSentryIssue } from '../schemas/sentry-webhook.schema.js';

const GITHUB_API_VERSION = '2022-11-28';
const DISPATCH_EVENT_TYPE = 'sentry-error';
const REQUEST_TIMEOUT_MS = 10_000;

export type DispatchResult =
  | { ok: true }
  | { ok: false; status: number; body: string };

export async function dispatchToGithub(
  issue: NormalizedSentryIssue,
  aiContext: AiDebugContext,
): Promise<DispatchResult> {
  const env = getEnv();
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;

  const requestBody = {
    event_type: DISPATCH_EVENT_TYPE,
    client_payload: {
      issue_id: issue.issueId,
      title: issue.title,
      sentry_url: issue.sentryUrl,
      environment: issue.environment,
      level: issue.level,
      project: issue.projectSlug,
      project_id: issue.projectId,
      agent: 'claude-code',
      mode: 'analysis',
      ai_context: aiContext,
    },
  };

  logger.info('Dispatching to GitHub', { url, issueId: issue.issueId });
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    logger.error('GitHub dispatch request error', {
      issueId: issue.issueId,
      elapsedMs: Date.now() - startedAt,
      timedOut,
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, status: timedOut ? 504 : 502, body: String(error) };
  }

  if (response.ok) {
    logger.info('GitHub dispatch succeeded', {
      issueId: issue.issueId,
      eventType: DISPATCH_EVENT_TYPE,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
    });
    return { ok: true };
  }

  const errorBody = await response.text();
  logger.error('GitHub dispatch failed', {
    issueId: issue.issueId,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    body: errorBody,
  });

  return { ok: false, status: response.status, body: errorBody };
}
