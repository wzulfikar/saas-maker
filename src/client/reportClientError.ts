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

      try {
        const Sentry = await import('@sentry/browser')
        Sentry.captureException(error, payload)
        await Sentry.flush().catch((e) => {
          console.error('[saas-maker] reportClientError: `Sentry.flush` failed. error:', e)
        })
      } catch (_importError) {
        // Suppress import error. Happens when the user doesn't use the library.
      }
      break;
    }
    default: {
      await reportErrorShared(reporter, error, params);
    }
  }
}

reportClientError.reporter = process.env.NEXT_PUBLIC_SAAS_MAKER_ERROR_REPORTER || process.env.VITE_PUBLIC_SAAS_MAKER_ERROR_REPORTER

export { reportClientError }
