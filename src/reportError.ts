import { reportErrorShared, type ReportErrorParams } from "./reportErrorClient";

/**
 * Report error (server side) to the error reporting service configured via `SAAS_MAKER_ERROR_REPORTER` environment variable.
 * It will use `console` as fallback logger if no error reporting service is configured.
 * @param error 
 * @param params
 */
export function reportError(error: unknown, params?: ReportErrorParams) {
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
