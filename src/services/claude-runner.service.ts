import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import type { AiDebugContext } from '../schemas/ai-debug-context.schema.js';
import type { NormalizedSentryIssue } from '../schemas/sentry-webhook.schema.js';

export type RunResult = { ok: true } | { ok: false; error: string };

export function runClaudeCode(
  issue: NormalizedSentryIssue,
  aiContext: AiDebugContext,
): void {
  const env = getEnv();
  const contextFile = join('/tmp', `sentry-${issue.issueId}.json`);

  writeFileSync(contextFile, JSON.stringify(aiContext, null, 2));

  const prompt = `Sentry 에러가 발생했습니다. @${contextFile} 의 컨텍스트를 바탕으로 원인을 분석하고, 코드를 수정한 뒤 PR을 생성해주세요.

에러 요약:
- Issue ID: ${issue.issueId}
- Title: ${issue.title}
- Sentry URL: ${issue.sentryUrl ?? ''}
- Environment: ${issue.environment ?? 'unknown'}

작업 순서:
1. 스택트레이스와 브레드크럼으로 root cause 파악
2. 관련 파일 탐색 및 수정
3. 새 브랜치 생성 (fix/sentry-${issue.issueId})
4. 변경사항 커밋 및 푸시
5. gh pr create 로 PR 생성`;

  logger.info('Spawning Claude Code', { issueId: issue.issueId, repoPath: env.REPO_PATH });

  const proc = spawn(
    'claude',
    ['--print', '--dangerously-skip-permissions', '--allowedTools', 'Bash,Read,Edit,Write', prompt],
    {
      cwd: env.REPO_PATH,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  proc.stdout.on('data', (data: Buffer) => {
    logger.info('Claude stdout', { issueId: issue.issueId, output: data.toString().slice(0, 500) });
  });

  proc.stderr.on('data', (data: Buffer) => {
    logger.error('Claude stderr', { issueId: issue.issueId, output: data.toString().slice(0, 500) });
  });

  proc.on('close', (code) => {
    try { unlinkSync(contextFile); } catch {}
    if (code === 0) {
      logger.info('Claude Code completed', { issueId: issue.issueId });
    } else {
      logger.error('Claude Code failed', { issueId: issue.issueId, exitCode: code });
    }
  });

  proc.unref();
}
