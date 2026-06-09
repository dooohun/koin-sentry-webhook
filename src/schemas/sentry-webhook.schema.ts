export type SentryFrame = {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  context_line?: string;
  in_app?: boolean;
  abs_path?: string;
};

export type SentryStacktrace = {
  frames?: SentryFrame[];
};

export type SentryBreadcrumb = {
  timestamp?: string | number;
  category?: string;
  type?: string;
  level?: string;
  message?: string;
  data?: Record<string, unknown>;
};

export type SentryEntry = {
  type?: string;
  data?: {
    values?: unknown[];
    [key: string]: unknown;
  };
};

export type SentryEvent = {
  id?: string | number;
  event_id?: string | number;
  issue_id?: string | number;
  title?: string;
  message?: string;
  web_url?: string;
  environment?: string;
  level?: string;
  project?: string | number;
  project_slug?: string;
  projectSlug?: string;
  project_name?: string;
  culprit?: string;
  transaction?: string;
  timestamp?: string | number;
  release?: string;
  dist?: string;
  userAgent?: string;
  exception?: {
    values?: Array<{
      stacktrace?: SentryStacktrace;
    }>;
  };
  entries?: SentryEntry[];
  breadcrumbs?: {
    values?: SentryBreadcrumb[];
  };
  contexts?: {
    browser?: { name?: string; version?: string };
    os?: { name?: string; version?: string };
    device?: { name?: string; family?: string; model?: string };
    [key: string]: unknown;
  };
  request?: {
    url?: string;
    headers?: Record<string, string> | Array<[string, string]>;
    [key: string]: unknown;
  };
  tags?: Array<{ key?: string; value?: unknown }> | Record<string, unknown>;
};

export type SentryWebhookPayload = {
  data?: {
    issue?: {
      id?: string | number;
      title?: string;
      web_url?: string;
      permalink?: string;
      level?: string;
      project?: string | number;
    };
    event?: SentryEvent;
  };
  project?: string | number;
  project_slug?: string;
  projectSlug?: string;
  project_name?: string;
  environment?: string;
  level?: string;
  tags?: Array<{ key?: string; value?: unknown }> | Record<string, unknown>;
};

export type NormalizedSentryIssue = {
  issueId?: string;
  eventId?: string;
  title: string;
  sentryUrl?: string;
  environment?: string;
  level?: string;
  projectSlug?: string;
  projectId?: string;
};

export function normalizeSentryPayload(
  body: SentryWebhookPayload,
): NormalizedSentryIssue {
  const issue = body.data?.issue;
  const event = body.data?.event;

  // number로 오는 ID를 문자열로 통일해 GitHub Actions에서 지수 표기 깨짐을 방지한다.
  const str = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value);

  const rawProject = body.project ?? event?.project ?? issue?.project;
  const projectId = str(rawProject);
  const projectSlug =
    body.project_slug ??
    body.projectSlug ??
    event?.project_slug ??
    event?.projectSlug ??
    body.project_name ??
    event?.project_name ??
    process.env['SENTRY_PROJECT'] ??
    projectId;

  return {
    issueId: str(issue?.id ?? event?.issue_id ?? event?.id),
    eventId: str(event?.event_id ?? event?.id),
    title:
      str(issue?.title ?? event?.title ?? event?.message) ??
      'Unknown Sentry Issue',
    sentryUrl: str(issue?.web_url ?? event?.web_url ?? issue?.permalink),
    environment: str(event?.environment ?? body.environment),
    level: str(event?.level ?? issue?.level ?? body.level),
    projectSlug,
    projectId,
  };
}
