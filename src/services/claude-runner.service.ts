import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';
import * as processedStore from './processed-store.service.js';
import { postIssueComment } from './sentry-comment.service.js';
import type { AiDebugContext } from '../schemas/ai-debug-context.schema.js';
import type { NormalizedSentryIssue } from '../schemas/sentry-webhook.schema.js';

const PR_URL_REGEX = /https:\/\/github\.com\/[^\s/]+\/[^\s/]+\/pull\/\d+/;

export function runClaudeCode(
  issue: NormalizedSentryIssue,
  aiContext: AiDebugContext,
): void {
  const env = getEnv();
  const issueId = issue.issueId as string;
  const contextFile = join('/tmp', `sentry-${issueId}.json`);

  writeFileSync(contextFile, JSON.stringify(aiContext, null, 2));

  const baseBranch = issue.environment === 'production' ? 'main' : 'develop';

  const prompt = `Sentry 에러가 발생했습니다. @${contextFile} 의 컨텍스트를 바탕으로 원인을 분석하고, 코드를 수정한 뒤 PR을 생성해주세요.

에러 요약:
- Issue ID: ${issueId}
- Title: ${issue.title}
- Sentry URL: ${issue.sentryUrl ?? ''}
- Environment: ${issue.environment ?? 'unknown'}
- Base Branch: ${baseBranch}

작업 순서:
1. 스택트레이스와 브레드크럼으로 root cause 파악
2. 관련 파일 탐색 및 수정
3. ${baseBranch} 브랜치 최신화 후 fix 브랜치 생성:
   git checkout ${baseBranch} && git pull origin ${baseBranch} && git checkout -b fix/sentry-${issueId}
4. 변경사항 커밋 및 푸시
5. .github 폴더의 PR 템플릿을 확인하고 그 형식에 맞춰 gh pr create --base ${baseBranch} 로 PR 생성

코드 작성 시 주의사항:
- 주석은 코드만으로 이해하기 어려운 비자명한 이유가 있을 때만 작성해라.
- 코드 자체로 의도가 명확한 경우 주석을 달지 마라.`;

  logger.info('Spawning Claude Code', { issueId: issueId, repoPath: env.REPO_PATH });

  const proc = spawn(
    'claude',
    ['--print', '--dangerously-skip-permissions', '--allowedTools', 'Bash,Read,Edit,Write'],
    {
      cwd: env.REPO_PATH,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    },
  );

  proc.stdin.write(prompt);
  proc.stdin.end();

  let stdoutBuffer = '';

  proc.stdout.on('data', (data: Buffer) => {
    const chunk = data.toString();
    stdoutBuffer += chunk;
    logger.info('Claude stdout', { issueId: issueId, output: chunk.slice(0, 500) });
  });

  proc.stderr.on('data', (data: Buffer) => {
    logger.error('Claude stderr', { issueId: issueId, output: data.toString().slice(0, 500) });
  });

  proc.on('close', (code) => {
    try { unlinkSync(contextFile); } catch {}
    if (code === 0) {
      const prUrl = PR_URL_REGEX.exec(stdoutBuffer)?.[0];
      logger.info('Claude Code completed', { issueId: issueId, prUrl });
      void processedStore.markCompleted(issueId, prUrl);
      const comment = prUrl
        ? `🤖 자동 분석 후 수정 PR을 생성했습니다: ${prUrl}`
        : '🤖 자동 분석이 완료됐지만 PR URL을 찾지 못했습니다. 로그를 확인해주세요.';
      void postIssueComment(issueId, comment);
    } else {
      logger.error('Claude Code failed', { issueId: issueId, exitCode: code });
      void processedStore.markFailed(issueId, `exit code ${code}`);
      void postIssueComment(issueId, `⚠️ 자동 수정에 실패했습니다 (exit ${code}). 로그를 확인해주세요.`);
    }
  });

  proc.unref();
}
