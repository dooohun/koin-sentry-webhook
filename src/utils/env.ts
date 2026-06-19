import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),

  REPO_PATH: z.string().min(1, 'REPO_PATH is required'),
  PROCESSED_STORE_PATH: z.string().default('./data/processed.json'),

  SENTRY_WEBHOOK_SECRET: z.string().min(1, 'SENTRY_WEBHOOK_SECRET is required'),
  SENTRY_API_TOKEN: z.string().optional(),
  SENTRY_API_BASE_URL: z.string().default('https://sentry.io'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');

    throw new Error(`Invalid environment variables:\n${issues}`);
  }

  cached = parsed.data;
  return cached;
}
