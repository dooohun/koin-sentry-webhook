import type { AiDebugContext } from "../schemas/ai-debug-context.schema.js";
import type {
  NormalizedSentryIssue,
  SentryBreadcrumb,
  SentryEvent,
  SentryFrame,
  SentryWebhookPayload,
} from "../schemas/sentry-webhook.schema.js";
import { isSensitiveKey, sanitizeRecord, truncateString } from "../utils/sanitize.js";

const MAX_FRAMES = 20;
const MAX_BREADCRUMBS = 20;
const MAX_TAGS = 50;

const str = (value: unknown): string | undefined =>
  value === undefined || value === null ? undefined : String(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function findEntryValues(event: SentryEvent, type: string): unknown[] {
  const entries = Array.isArray(event.entries) ? event.entries : [];
  for (const entry of entries) {
    if (entry?.type === type && Array.isArray(entry.data?.values)) {
      return entry.data!.values as unknown[];
    }
  }
  return [];
}

function pickFrame(frame: SentryFrame): AiDebugContext["stacktrace"]["frames"][number] {
  return {
    filename: str(frame.filename),
    function: str(frame.function),
    lineno: typeof frame.lineno === "number" ? frame.lineno : undefined,
    colno: typeof frame.colno === "number" ? frame.colno : undefined,
    context_line:
      frame.context_line !== undefined ? truncateString(String(frame.context_line)) : undefined,
    in_app: typeof frame.in_app === "boolean" ? frame.in_app : undefined,
    abs_path: str(frame.abs_path),
  };
}

function extractFrames(event: SentryEvent): SentryFrame[] {
  const fromException = event.exception?.values?.[0]?.stacktrace?.frames;
  if (Array.isArray(fromException) && fromException.length > 0) {
    return fromException;
  }

  for (const type of ["exception", "stacktrace"]) {
    const values = findEntryValues(event, type);
    for (const value of values) {
      if (!isPlainObject(value)) continue;
      const st = (value as Record<string, unknown>).stacktrace;
      const frames =
        isPlainObject(st) && Array.isArray((st as Record<string, unknown>).frames)
          ? ((st as Record<string, unknown>).frames as SentryFrame[])
          : Array.isArray((value as Record<string, unknown>).frames)
            ? ((value as Record<string, unknown>).frames as SentryFrame[])
            : undefined;
      if (frames && frames.length > 0) return frames;
    }
  }

  return [];
}

function buildStacktrace(event: SentryEvent): AiDebugContext["stacktrace"] {
  // Sentry frames는 오래된 것 -> 최근 호출 순서이므로 마지막 N개를 유지한다.
  const frames = extractFrames(event).slice(-MAX_FRAMES).map(pickFrame);

  const inAppFrames = frames.filter((f) => f.in_app === true);
  const top_in_app_frame =
    inAppFrames.length > 0
      ? inAppFrames[inAppFrames.length - 1]
      : frames.length > 0
        ? frames[frames.length - 1]
        : undefined;

  return { top_in_app_frame, frames };
}

function pickBreadcrumb(bc: SentryBreadcrumb): AiDebugContext["breadcrumbs"]["last_items"][number] {
  return {
    timestamp: str(bc.timestamp),
    category: str(bc.category),
    type: str(bc.type),
    level: str(bc.level),
    message: bc.message !== undefined ? truncateString(String(bc.message)) : undefined,
    data: isPlainObject(bc.data) ? sanitizeRecord(bc.data) : undefined,
  };
}

function extractBreadcrumbs(event: SentryEvent): SentryBreadcrumb[] {
  if (Array.isArray(event.breadcrumbs?.values)) {
    return event.breadcrumbs!.values!;
  }
  const fromEntries = findEntryValues(event, "breadcrumbs");
  return fromEntries.filter(isPlainObject) as SentryBreadcrumb[];
}

function buildBreadcrumbs(event: SentryEvent): AiDebugContext["breadcrumbs"] {
  const last_items = extractBreadcrumbs(event).slice(-MAX_BREADCRUMBS).map(pickBreadcrumb);
  return { last_items };
}

function buildTags(event: SentryEvent, body: SentryWebhookPayload): Record<string, string> {
  const source = event.tags ?? body.tags;
  const out: Record<string, string> = {};
  if (source === undefined || source === null) return out;

  const add = (key: string, value: unknown) => {
    if (Object.keys(out).length >= MAX_TAGS) return;
    if (!key) return;
    out[key] = isSensitiveKey(key) ? "[REDACTED]" : truncateString(String(value ?? ""));
  };

  if (Array.isArray(source)) {
    for (const item of source) {
      if (isPlainObject(item)) {
        const key = str((item as Record<string, unknown>).key);
        if (key) add(key, (item as Record<string, unknown>).value);
      }
    }
  } else if (isPlainObject(source)) {
    for (const [key, value] of Object.entries(source)) {
      add(key, value);
    }
  }

  return out;
}

type SentryRequestHeaders = Record<string, string> | Array<[string, string]> | undefined;

function getHeader(headers: SentryRequestHeaders, name: string): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  if (Array.isArray(headers)) {
    for (const pair of headers) {
      if (Array.isArray(pair) && str(pair[0])?.toLowerCase() === lower) {
        return str(pair[1]);
      }
    }
    return undefined;
  }
  if (isPlainObject(headers)) {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lower) return str(value);
    }
  }
  return undefined;
}

function buildRuntime(event: SentryEvent): AiDebugContext["runtime"] {
  const contexts = event.contexts ?? {};
  const request = event.request ?? {};

  const userAgent = getHeader(request.headers, "User-Agent") ?? str(event.userAgent);

  const browser = contexts.browser
    ? { name: str(contexts.browser.name), version: str(contexts.browser.version) }
    : undefined;
  const os = contexts.os
    ? { name: str(contexts.os.name), version: str(contexts.os.version) }
    : undefined;
  const device = contexts.device
    ? {
        name: str(contexts.device.name),
        family: str(contexts.device.family),
        model: str(contexts.device.model),
      }
    : undefined;

  return {
    browser,
    os,
    device,
    url: str(request.url),
    user_agent: userAgent ? truncateString(userAgent) : undefined,
  };
}

const AI_INSTRUCTIONS: AiDebugContext["ai_instructions"] = {
  goal: "Analyze the root cause of this Sentry issue, fix the code, and create a pull request.",
  constraints: [
    "Prefer in-app stack frames over node_modules or framework frames.",
    "Use breadcrumbs to infer the reproduction path.",
    "Consider WebView/native bridge behavior if the issue is related to authentication, navigation, token handling, or platform-specific behavior.",
    "Do not expose secrets, tokens, cookies, or personally identifiable information.",
    "Create a new branch named fix/sentry-{issue_id} before making changes.",
    "Write a clear PR description explaining the root cause and the fix.",
  ],
  expected_output: [
    "Root cause analysis",
    "Code fix applied to relevant files",
    "New branch created and pushed",
    "Pull request created via gh pr create",
  ],
};

export function buildAiContext(
  body: SentryWebhookPayload,
  issue: NormalizedSentryIssue,
): AiDebugContext {
  const event: SentryEvent = body.data?.event ?? {};

  return {
    schema_version: "1.0",
    source: "sentry",
    mode: "analysis",
    issue: {
      id: issue.issueId ?? "",
      title: issue.title,
      url: issue.sentryUrl,
      level: issue.level,
      environment: issue.environment,
      project: issue.projectSlug,
      project_id: issue.projectId,
    },
    event: {
      id: issue.eventId,
      message: truncateString(str(event.message) ?? issue.title),
      culprit: event.culprit ? truncateString(String(event.culprit)) : undefined,
      transaction: str(event.transaction),
      timestamp: str(event.timestamp),
    },
    runtime: buildRuntime(event),
    release: {
      version: str(event.release),
      dist: str(event.dist),
    },
    stacktrace: buildStacktrace(event),
    breadcrumbs: buildBreadcrumbs(event),
    tags: buildTags(event, body),
    ai_instructions: AI_INSTRUCTIONS,
  };
}
