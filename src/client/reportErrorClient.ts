import type { ReportErrorParams } from '../types';
import { reportErrorShared } from '../internal/reportErrorShared';

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
