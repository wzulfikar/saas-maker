export type SeverityLevel = "debug" | "info" | "warning" | "error" | "fatal" & (string & {});

export type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

export type ReportErrorParams = {
  ctx?: string,
  level?: SeverityLevel
  userId?: string
  fallbackLogger?: Logger
}

export function logReport(error: unknown, params?: ReportErrorParams) {
  const logger = params?.fallbackLogger || console;
  const logLevel = params?.level && params.level in logger ? params.level : 'error';
  logger[logLevel as keyof Logger](`[SAAS_MAKER] reportError called: '${error}'. params: ${JSON.stringify(params)}`);
}

export function reportErrorShared(error: unknown, params?: ReportErrorParams) {
  switch (process.env.SAAS_MAKER_ERROR_REPORTER) {
    case 'bugsnag': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };
      break;
    }
    default: {
      logReport(error, params);
    }
  }
}

export function reportErrorClient(error: unknown, params?: ReportErrorParams) {
  switch (process.env.SAAS_MAKER_ERROR_REPORTER) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };
      import('@sentry/browser').then((Sentry) => Sentry.captureException(error, payload));
      break;
    }
    default: {
      reportErrorShared(error, params);
    }
  }
}
