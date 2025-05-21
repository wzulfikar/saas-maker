import type { Flag } from './flags';

export const fetchFlagsPosthogJs = async (): Promise<Record<string, Flag>> => {
  const { default: posthog } = await import('posthog-js')
  return new Promise((resolve) => {
    posthog.onFeatureFlags((flags) => {
      resolve(
        flags.reduce(
          (acc, flag) => {
            acc[flag] = { enabled: true };
            return acc;
          },
          {} as Record<string, Flag>,
        ),
      );
    });
  });
};
