import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  GITHUB_TOKEN: z.string().min(1, 'GITHUB_TOKEN is required'),
  GITHUB_OWNER: z.string().min(1, 'GITHUB_OWNER is required'),
  GITHUB_REPO: z.string().min(1, 'GITHUB_REPO is required'),

  SENTRY_WEBHOOK_SECRET: z.string().min(1, 'SENTRY_WEBHOOK_SECRET is required'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`[env] Invalid environment variables:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
