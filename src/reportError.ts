type SeverityLevel = "debug" | "info" | "warning" | "error" | "fatal" & (string & {});

type Logger = {
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
}

/**
 * Report error to the error reporting service configured via `SAAS_MAKER_ERROR_REPORTER` environment variable.
 * It will use `console` as fallback logger if no error reporting service is configured.
 * @param error 
 * @param params
 */
export function reportError(error: unknown, params?: {
  ctx?: string,
  level?: SeverityLevel
  userId?: string
  fallbackLogger?: Logger
}) {
  const reporterConfigServerSide = process.env.SAAS_MAKER_ERROR_REPORTER;
  const reporterConfigClientSide = process.env.NEXT_PUBLIC_SAAS_MAKER_ERROR_REPORTER || process.env.VITE_SAAS_MAKER_ERROR_REPORTER;
  const isClient = typeof window !== 'undefined';

  switch (reporterConfigServerSide || reporterConfigClientSide) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };
      if (isClient) {
        import('@sentry/browser').then((Sentry) => Sentry.captureException(error, payload));
      } else {
        import('@sentry/node').then((Sentry) => Sentry.captureException(error, payload));
      }
      break;
    }
    case 'bugsnag': {
      import('@bugsnag/js').then((Bugsnag) => {
        Bugsnag.default.notify(error as any, (event) => {
          if (params?.ctx) event.context = params.ctx
          if (params?.level && ['info', 'warning', 'error'].includes(params.level))
            event.severity = params.level as 'info' | 'warning' | 'error';
          if (params?.userId) event.setUser(params.userId);
        })
      });
      break;
    }
    default: {
      const logger = params?.fallbackLogger || console;
      const logLevel = params?.level && params.level in logger ? params.level : 'error';
      logger[logLevel as keyof Logger](`[SAAS_MAKER] reportError called: '${error}'. params: ${JSON.stringify(params)}`);
    }
  }
}
