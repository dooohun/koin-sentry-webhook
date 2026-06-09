export type SentryWebhookPayload = {
  data?: {
    issue?: {
      id?: string | number;
      title?: string;
      web_url?: string;
      permalink?: string;
    };
    event?: {
      id?: string | number;
      issue_id?: string | number;
      title?: string;
      web_url?: string;
      environment?: string;
      level?: string;
      project?: string | number;
    };
  };
  project?: string | number;
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

  // Sentry는 일부 ID/project를 number로 보낸다. 모두 문자열로 통일해
  // GitHub Actions에서 큰 숫자가 지수 표기로 깨지는 것을 방지한다.
  const str = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value);

  return {
    issueId: str(issue?.id ?? event?.issue_id ?? event?.id),
    title: str(issue?.title ?? event?.title) ?? 'Unknown Sentry Issue',
    sentryUrl: str(issue?.web_url ?? event?.web_url ?? issue?.permalink),
    environment: str(event?.environment ?? body.environment),
    level: str(event?.level ?? body.level),
    project: str(body.project ?? event?.project),
  };
}
