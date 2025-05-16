import type { ReportErrorParams } from '../types';
import { reportErrorShared } from '../internal/reportErrorShared';

export function reportServerError(error: unknown, params?: ReportErrorParams) {
  const reporter = process.env.SAAS_MAKER_ERROR_REPORTER || 'logger';
  switch (reporter) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };

      import('@sentry/node').then((Sentry) => {
        Sentry.captureException(error, payload)
        Sentry.flush()
      });
      break;
    }
    default: {
      reportErrorShared(reporter, error, params);
    }
  }
}
