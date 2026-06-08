import { env } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import type { NormalizedSentryIssue } from '../schemas/sentry-webhook.schema.js';

const GITHUB_API_VERSION = '2022-11-28';
const DISPATCH_EVENT_TYPE = 'sentry-error';

export type DispatchResult =
  | { ok: true }
  | { ok: false; status: number; body: string };

export async function dispatchToGithub(
  issue: NormalizedSentryIssue,
): Promise<DispatchResult> {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/dispatches`;

  const requestBody = {
    event_type: DISPATCH_EVENT_TYPE,
    client_payload: {
      issue_id: issue.issueId,
      title: issue.title,
      sentry_url: issue.sentryUrl,
      environment: issue.environment,
      level: issue.level,
      project: issue.project,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
    },
    body: JSON.stringify(requestBody),
  });

  if (response.ok) {
    logger.info('GitHub dispatch succeeded', {
      issueId: issue.issueId,
      eventType: DISPATCH_EVENT_TYPE,
      status: response.status,
    });
    return { ok: true };
  }

  const errorBody = await response.text();
  logger.error('GitHub dispatch failed', {
    issueId: issue.issueId,
    status: response.status,
    body: errorBody,
  });

  return { ok: false, status: response.status, body: errorBody };
}
