import type { Logger, ReportErrorParams } from './types';

export function logError(error: unknown, params?: ReportErrorParams) {
  const logger = params?.fallbackLogger || console;
  const logLevel = params?.level && params.level in logger ? params.level : 'error';
  logger[logLevel as keyof Logger](`[saas-maker] logError called: '${error}'. params: ${JSON.stringify(params)}`);
}
