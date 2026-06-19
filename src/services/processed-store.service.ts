import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { getEnv } from '../utils/env.js';
import { logger } from '../utils/logger.js';

export type ProcessStatus = 'processing' | 'completed' | 'failed';

export interface ProcessRecord {
  status: ProcessStatus;
  prUrl?: string;
  error?: string;
  updatedAt: string;
}

type Store = Record<string, ProcessRecord>;

let writeChain: Promise<void> = Promise.resolve();

function storePath(): string {
  return getEnv().PROCESSED_STORE_PATH;
}

function readStore(): Store {
  const path = storePath();
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Store;
  } catch {
    return {};
  }
}

function writeStore(store: Store): void {
  const path = storePath();
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf-8');
  renameSync(tmp, path);
}

function enqueue(fn: () => void): Promise<void> {
  writeChain = writeChain
    .then(() => { fn(); })
    .catch((err) => {
      logger.error('ProcessedStore write error', { error: String(err) });
    });
  return writeChain;
}

export function get(issueId: string): ProcessRecord | undefined {
  return readStore()[issueId];
}

export function markProcessing(issueId: string): Promise<void> {
  return enqueue(() => {
    const store = readStore();
    store[issueId] = { status: 'processing', updatedAt: new Date().toISOString() };
    writeStore(store);
    logger.info('ProcessedStore: markProcessing', { issueId });
  });
}

export function markCompleted(issueId: string, prUrl?: string): Promise<void> {
  return enqueue(() => {
    const store = readStore();
    store[issueId] = { status: 'completed', prUrl, updatedAt: new Date().toISOString() };
    writeStore(store);
    logger.info('ProcessedStore: markCompleted', { issueId, prUrl });
  });
}

export function markFailed(issueId: string, error: string): Promise<void> {
  return enqueue(() => {
    const store = readStore();
    store[issueId] = { status: 'failed', error, updatedAt: new Date().toISOString() };
    writeStore(store);
    logger.error('ProcessedStore: markFailed', { issueId, error });
  });
}
