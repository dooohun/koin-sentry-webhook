import type { IncomingMessage, ServerResponse } from 'node:http';
import { app } from '../src/app.js';
import { logger } from '../src/utils/logger.js';

export const config = {
  maxDuration: 30,
};

// 재계산되어야 하는 헤더들 — req.body를 재직렬화하면 원본과 길이가 달라질 수 있어 제거
const STRIP_HEADERS = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
]);

function toWebHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || STRIP_HEADERS.has(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => headers.append(key, v));
    } else {
      headers.set(key, value);
    }
  }
  return headers;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const method = req.method ?? 'GET';
  const url = `https://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;

  // Vercel이 스트림을 미리 소비하므로 스트림을 읽지 않고 파싱된 req.body를 사용한다.
  let body: string | undefined;
  if (method !== 'GET' && method !== 'HEAD') {
    const parsed = (req as unknown as { body?: unknown }).body;
    if (typeof parsed === 'string') {
      body = parsed;
    } else if (parsed !== undefined && parsed !== null) {
      body = JSON.stringify(parsed);
    }
    logger.info('Vercel request body resolved', {
      method,
      bodyType: typeof parsed,
      length: body?.length ?? 0,
    });
  }

  const request = new Request(url, {
    method,
    headers: toWebHeaders(req),
    body,
  });

  const response = await app.fetch(request);

  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}
