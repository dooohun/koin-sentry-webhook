export type SentryWebhookPayload = {
  data?: {
    issue?: {
      id?: string;
      title?: string;
      web_url?: string;
      permalink?: string;
    };
    event?: {
      id?: string;
      issue_id?: string;
      title?: string;
      web_url?: string;
      environment?: string;
      level?: string;
      project?: string;
    };
  };
  project?: string;
  environment?: string;
  level?: string;
};

export type NormalizedSentryIssue = {
  issueId?: string;
  title: string;
  sentryUrl?: string;
  environment?: string;
  level?: string;
  project?: string;
};

export function normalizeSentryPayload(
  body: SentryWebhookPayload,
): NormalizedSentryIssue {
  const issue = body.data?.issue;
  const event = body.data?.event;

  const issueId = issue?.id ?? event?.issue_id ?? event?.id;
  const title = issue?.title ?? event?.title ?? 'Unknown Sentry Issue';
  const sentryUrl = issue?.web_url ?? event?.web_url ?? issue?.permalink;
  const environment = event?.environment ?? body.environment;
  const level = event?.level ?? body.level;
  const project = body.project ?? event?.project;

  return {
    issueId,
    title,
    sentryUrl,
    environment,
    level,
    project,
  };
}
