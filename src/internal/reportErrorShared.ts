import { logError } from '../shared/logError';
import type { ReportErrorParams } from '../types';

const reportErrorShared = async (reporter: string, error: unknown, params?: ReportErrorParams) => {
  switch (reporter) {
    case 'bugsnag': {
      try {
        const Bugsnag = await import('@bugsnag/js')
        Bugsnag.default.notify(error as Error, (event) => {
          if (params?.ctx) event.context = params.ctx;
          if (params?.level) event.severity = params.level as 'info' | 'warning' | 'error';
          if (params?.userId) event.setUser(params.userId);
        })
      } catch (_importError) {
        // Suppress import error. Happens when Bugsnag is not installed (eg. user doesn't use bugsnag).
      }
      break;
    }
    case 'logger': {
      logError(error, params);
      break;
    }
    default: {
      console.error(`[saas-maker] error reported with unknown reporter '${reporter}'`, { error, params });
    }
  }
}

export { reportErrorShared }
