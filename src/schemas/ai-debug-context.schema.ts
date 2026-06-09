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
    project?: string;
    project_id?: string;
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
