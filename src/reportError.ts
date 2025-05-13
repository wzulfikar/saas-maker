type SeverityLevel = "debug" | "info" | "warning" | "error" | "fatal" & (string & {});

type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

type ReportErrorParams = {
  ctx?: string,
  level?: SeverityLevel
  userId?: string
  fallbackLogger?: Logger
}

function logReport(error: unknown, params?: ReportErrorParams) {
  const logger = params?.fallbackLogger || console;
  const logLevel = params?.level && params.level in logger ? params.level : 'error';
  logger[logLevel as keyof Logger](`[SAAS_MAKER] reportError called: '${error}'. params: ${JSON.stringify(params)}`);
}

function reportErrorShared(error: unknown, params?: ReportErrorParams) {
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

/**
 * Report error to the error reporting service configured via `SAAS_MAKER_ERROR_REPORTER` environment variable.
 * It will use `console` as fallback logger if no error reporting service is configured.
 * @param error 
 * @param params
 */
function reportErrorServer(error: unknown, params?: ReportErrorParams) {
  switch (process.env.SAAS_MAKER_ERROR_REPORTER) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };
      import('@sentry/node').then((Sentry) => Sentry.captureException(error, payload));
      break;
    }
    default: {
      reportErrorShared(error, params);
    }
  }
}

function reportErrorClient(error: unknown, params?: ReportErrorParams) {
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

export function reportError(error: unknown, params?: ReportErrorParams) {
  if (typeof window === 'undefined') {
    reportErrorServer(error, params);
  } else {
    reportErrorClient(error, params);
  }
}
