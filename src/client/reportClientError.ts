import type { ErrorReporter, ReportErrorParams } from '../types';
import { reportErrorShared } from '../internal/reportErrorShared';

const reportClientError: ErrorReporter = async (error: unknown, params?: ReportErrorParams) => {
  if (reportClientError.customReporter) {
    return reportClientError.customReporter(error, params);
  }

  const reporter = reportClientError.reporter || 'logger';
  switch (reporter) {
    case 'sentry': {
      const payload = {} as Record<string, unknown>;
      if (params?.ctx) payload.extra = { context: params.ctx };
      if (params?.level) payload.level = params.level;
      if (params?.userId) payload.user = { id: params.userId };

      await import('@sentry/browser').then(async (Sentry) => {
        Sentry.captureException(error, payload)
        await Sentry.flush().catch((e) => {
          console.error('[saas-maker] reportClientError: `Sentry.flush` failed. error:', e)
        })
      });
      break;
    }
    default: {
      return reportErrorShared(reporter, error, params);
    }
  }
}

reportClientError.reporter = process.env.NEXT_PUBLIC_SAAS_MAKER_ERROR_REPORTER || process.env.VITE_PUBLIC_SAAS_MAKER_ERROR_REPORTER

export { reportClientError }
