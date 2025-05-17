import type { ReportErrorParams, ErrorReporter } from '../types';
import { reportErrorShared } from '../internal/reportErrorShared';

const reportServerError: ErrorReporter = async (error: unknown, params?: ReportErrorParams) => {
  if (reportServerError.customReporter) {
    return reportServerError.customReporter(error, params);
  }

  const reporter = reportServerError.reporter || 'logger';
  switch (reporter) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };

      await import('@sentry/node').then(async (Sentry) => {
        Sentry.captureException(error, payload)
        await Sentry.flush()
      });
      break;
    }
    default: {
      return reportErrorShared(reporter, error, params);
    }
  }
}

reportServerError.reporter = process.env.SAAS_MAKER_ERROR_REPORTER

export { reportServerError }
