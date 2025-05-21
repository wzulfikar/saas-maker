import type { Flag } from '../flags';
import { createFlagsFromArrayString } from './createFlagsFromArrayString';

export const fetchFlagsPosthogJs = async (initParams?: { apiKey: string, apiHost?: string }): Promise<Record<string, Flag>> => {
  const { default: posthog } = await import('posthog-js')
  if (initParams) {
    posthog.init(initParams.apiKey, {
      api_host: initParams.apiHost,
    })
  }
  return new Promise((resolve) => {
    posthog.onFeatureFlags((flags) => {
      resolve(createFlagsFromArrayString(flags))
    });
  });
};
