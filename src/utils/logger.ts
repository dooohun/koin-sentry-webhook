type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogMeta = Record<string, unknown>;

function emit(level: LogLevel, message: string, meta?: LogMeta): void {
  const time = new Date().toISOString();
  const payload = meta && Object.keys(meta).length > 0 ? meta : undefined;

  const line = `[${time}] ${level.toUpperCase()} ${message}`;

  if (level === 'error') {
    console.error(line, payload ?? '');
  } else if (level === 'warn') {
    console.warn(line, payload ?? '');
  } else {
    console.log(line, payload ?? '');
  }
}

export const logger = {
  debug: (message: string, meta?: LogMeta) => emit('debug', message, meta),
  info: (message: string, meta?: LogMeta) => emit('info', message, meta),
  warn: (message: string, meta?: LogMeta) => emit('warn', message, meta),
  error: (message: string, meta?: LogMeta) => emit('error', message, meta),
};

export type Logger = typeof logger;
