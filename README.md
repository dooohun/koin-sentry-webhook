# koin-sentry-webhook

Sentry Issue Alert에서 전달된 webhook payload를 받아 GitHub `repository_dispatch` API를 호출하고, 이를 통해 GitHub Actions workflow를 트리거하는 Hono 기반 receiver 서버입니다.

## 프로젝트 목적

Sentry에서 에러가 발생하면 GitHub Actions를 자동으로 실행시키는 것이 목표입니다.
MVP 단계에서는 **GitHub Actions dispatch 성공까지만** 구현하며, Claude Code Action·PR 생성 등은 이후 단계에서 붙입니다.

추후 queue / worker / slack notification 등을 쉽게 확장할 수 있도록 route와 service를 분리한 구조로 작성했습니다.

## 전체 아키텍처

```txt
Sentry Alert
  → Hono Webhook Receiver  (POST /webhooks/sentry)
  → GitHub repository_dispatch API
  → GitHub Actions workflow 실행
```

요청 처리 흐름:

```txt
POST /webhooks/sentry
  ├─ 1. x-webhook-secret 검증            (불일치 → 401)
  ├─ 2. JSON payload 파싱                (실패 → 400)
  ├─ 3. payload 정규화 (defensive 추출)
  ├─ 4. issueId 존재 확인                (없음 → 400)
  ├─ 5. GitHub repository_dispatch 호출  (실패 → 500)
  └─ 6. { ok, dispatched, issueId } 응답
```

레이어 구성:

| 디렉토리    | 역할                                                  |
| ----------- | ----------------------------------------------------- |
| `routes/`   | 요청 검증 + 응답만 담당                               |
| `services/` | 외부 API 호출 (GitHub dispatch). 추후 worker가 재사용 |
| `schemas/`  | Sentry payload 타입 정의 + 정규화 로직                |
| `utils/`    | env validation, logger                                |

## 디렉토리 구조

```txt
api/
  index.ts                          # Vercel serverless 진입점 (hono/vercel handle)
src/
  index.ts                          # 로컬 실행 엔트리포인트 (@hono/node-server)
  app.ts                            # Hono 앱 구성 + 공통 에러/404 처리 (로컬·Vercel 공용)
  routes/
    sentry-webhook.route.ts         # POST /webhooks/sentry
  services/
    github-dispatch.service.ts      # GitHub repository_dispatch 호출
  schemas/
    sentry-webhook.schema.ts        # Sentry payload 타입 + normalize
  utils/
    env.ts                          # zod 기반 환경변수 검증
    logger.ts                       # console 기반 최소 로거
vercel.json                         # 모든 경로를 /api 함수로 rewrite
```

> 앱 정의(`src/app.ts`)는 로컬 실행과 Vercel 배포가 공유합니다. 로컬은 `src/index.ts`가 포트를 listen하고, Vercel은 `api/index.ts`가 요청당 함수로 호출합니다.

## 환경변수

`.env.example`를 복사해서 `.env`를 만들고 값을 채웁니다.

```bash
cp .env.example .env
```

| 변수                    | 필수               | 설명                                                                                                                                           |
| ----------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                  | 아니오 (기본 3000) | HTTP 서버 포트                                                                                                                                 |
| `GITHUB_TOKEN`          | **예**             | repository_dispatch 권한이 있는 GitHub 토큰. classic PAT면 `repo` scope, fine-grained PAT면 대상 repo의 **Contents: Read and write** 권한 필요 |
| `GITHUB_OWNER`          | **예**             | dispatch 대상 저장소의 owner (org 또는 user)                                                                                                   |
| `GITHUB_REPO`           | **예**             | dispatch 대상 저장소 이름                                                                                                                      |
| `SENTRY_WEBHOOK_SECRET` | **예**             | webhook 요청의 `x-webhook-secret` 헤더와 대조할 secret                                                                                         |

> 환경변수는 서버 부팅 시 한 번 검증되며, 필수 값이 비어 있으면 즉시 종료(fail fast)됩니다.

## 로컬 실행 방법

```bash
# 1. 의존성 설치
pnpm install

# 2. 환경변수 설정
cp .env.example .env
# .env 파일을 열어 GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, SENTRY_WEBHOOK_SECRET 입력

# 3. 타입 체크
pnpm typecheck

# 4. 개발 서버 실행 (tsx watch)
pnpm dev

# 또는 빌드 후 실행
pnpm build
pnpm start
```
