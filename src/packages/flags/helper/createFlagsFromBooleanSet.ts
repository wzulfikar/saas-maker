import type { Flag } from "../flags"

export const createFlagsFromBooleanSet = (booleanSet: Record<string, boolean | string>): Record<string, Flag> => {
  return Object.entries(booleanSet).reduce((acc, [key, value]) => {
    acc[key] = { enabled: !!value }
    return acc
  }, {} as Record<string, Flag>)
}
