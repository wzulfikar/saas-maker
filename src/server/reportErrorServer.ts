import { logError } from '../logError';
import type { ReportErrorParams } from '../types';

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
      logError(error, params);
    }
  }
}

export function reportErrorServer(error: unknown, params?: ReportErrorParams) {
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
