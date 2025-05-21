import type { Flag } from "../flags"

export const createFlagsFromArrayString = (flags: string[]): Record<string, Flag> => {
  return flags.reduce(
    (acc, flag) => {
      acc[flag] = { enabled: true };
      return acc;
    },
    {} as Record<string, Flag>,
  )
}
