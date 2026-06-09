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
  environment?: string;
  level?: string;
  tags?: Array<{ key?: string; value?: unknown }> | Record<string, unknown>;
};

export type AiDebugContext = {
  schema_version: '1.0';
  source: 'sentry';
  mode: 'analysis';

  issue: {
    id: string;
    title: string;
    url?: string;
    level?: string;
    environment?: string;
    project?: string | number;
  };

  event: {
    id?: string;
    message?: string;
    culprit?: string;
    transaction?: string;
    timestamp?: string;
  };

  runtime: {
    browser?: {
      name?: string;
      version?: string;
    };
    os?: {
      name?: string;
      version?: string;
    };
    device?: {
      name?: string;
      family?: string;
      model?: string;
    };
    url?: string;
    user_agent?: string;
  };

  release: {
    version?: string;
    dist?: string;
  };

  stacktrace: {
    top_in_app_frame?: {
      filename?: string;
      function?: string;
      lineno?: number;
      colno?: number;
      context_line?: string;
      abs_path?: string;
    };
    frames: Array<{
      filename?: string;
      function?: string;
      lineno?: number;
      colno?: number;
      context_line?: string;
      in_app?: boolean;
      abs_path?: string;
    }>;
  };

  breadcrumbs: {
    last_items: Array<{
      timestamp?: string;
      category?: string;
      type?: string;
      level?: string;
      message?: string;
      data?: Record<string, unknown>;
    }>;
  };

  tags: Record<string, string>;

  ai_instructions: {
    goal: string;
    constraints: string[];
    expected_output: string[];
  };
};

export type NormalizedSentryIssue = {
  issueId?: string;
  eventId?: string;
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

  // number로 오는 ID를 문자열로 통일해 GitHub Actions에서 지수 표기 깨짐을 방지한다.
  const str = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value);

  return {
    issueId: str(issue?.id ?? event?.issue_id ?? event?.id),
    eventId: str(event?.event_id ?? event?.id),
    title:
      str(issue?.title ?? event?.title ?? event?.message) ??
      'Unknown Sentry Issue',
    sentryUrl: str(issue?.web_url ?? event?.web_url ?? issue?.permalink),
    environment: str(event?.environment ?? body.environment),
    level: str(event?.level ?? issue?.level ?? body.level),
    project: str(body.project ?? event?.project ?? issue?.project),
  };
}
