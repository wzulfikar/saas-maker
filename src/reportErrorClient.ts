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

function logReport(error: unknown, params?: ReportErrorParams) {
  const logger = params?.fallbackLogger || console;
  const logLevel = params?.level && params.level in logger ? params.level : 'error';
  logger[logLevel as keyof Logger](`[saas-maker] reportErrorClient called: '${error}'. params: ${JSON.stringify(params)}`);
}

function reportErrorShared(reporter: string, error: unknown, params?: ReportErrorParams) {
  switch (reporter) {
    case 'bugsnag': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };

      import('@bugsnag/js').then((Bugsnag) => {
        Bugsnag.default.notify(error as any, (event) => {
          if (params?.ctx) event.context = params.ctx;
          if (params?.level) event.severity = params.level as 'info' | 'warning' | 'error';
          if (params?.userId) event.setUser(params.userId);
        })
      });
      break;
    }
    case 'logger': {
      logReport(error, params);
    }
  }
}

export function reportErrorClient(error: unknown, params?: ReportErrorParams) {
  const reporter = process.env.NEXT_PUBLIC_SAAS_MAKER_ERROR_REPORTER || process.env.VITE_PUBLIC_SAAS_MAKER_ERROR_REPORTER || 'logger';
  switch (reporter) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };

      import('@sentry/browser').then((Sentry) => Sentry.captureException(error, payload));
      break;
    }
    default: {
      reportErrorShared(reporter, error, params);
    }
  }
}
