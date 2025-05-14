import { logError } from '../shared/logError';
import type { ReportErrorParams } from '../types';

export function reportErrorShared(reporter: string, error: unknown, params?: ReportErrorParams) {
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
