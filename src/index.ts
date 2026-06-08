import { serve } from '@hono/node-server';
import { app } from './app.js';
import { env } from './utils/env.js';
import { logger } from './utils/logger.js';

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    logger.info('Sentry webhook receiver started', {
      port: info.port,
      owner: env.GITHUB_OWNER,
      repo: env.GITHUB_REPO,
    });
  },
);
