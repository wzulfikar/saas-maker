import type { Flags as FlagsConfig } from '../../types'

export type Flag = {
  enabled: boolean
  data?: Record<string, unknown>
}

type FlagId = FlagsConfig extends { id: infer U } ? U : string

// This interface will be available for module augmentation
export interface Flags {
  enabled: <T extends FlagId>(flagId: T, defaultValue?: boolean) => boolean
  get: <T extends FlagId, R extends Flag = Flag>(flagId: T, defaultValue?: R) => R | undefined
  fetch: <T extends Flag, U extends FlagId>(flagId: U) => Promise<T>
  /**
   * User ID to fetch flag for. You can initiate the value at the start of your app.
   **/
  userId?: string
  /**
   * Set the value of flags at the start of your app. 
   **/
  flags?: Record<string, Flag>
  /**
   * Function to fetch flag from the server. When set, `flags` will fetch the flag from the server
   * (if not found from `flags.flags`) and store it in the `flags.flags` object.
   **/
  fetchFlag?: (flagId: string, userId?: string) => Promise<Flag>
}

export const flags: Flags = {
  enabled: <T extends FlagId>(flagId: T, defaultValue?: boolean): boolean => {
    return flags.get(flagId, { enabled: defaultValue } as Flag)?.enabled || false
  },
  get: <T extends FlagId, R extends Flag = Flag>(flagId: T, defaultValue?: R): R | undefined => {
    const flag = flags.flags?.[flagId as keyof typeof flags.flags]
    return (flag ?? defaultValue) as R | undefined
  },
  fetch: async <T extends Flag, U extends FlagId>(flagId: U): Promise<T> => {
    if (!flags.fetchFlag) throw new Error('fetchFlag is not set')
    if (!flags.flags) flags.flags = {}
    const flag = await flags.fetchFlag(flagId, flags.userId)
    flags.flags[flagId as keyof typeof flags.flags] = flag
    return flag as T
  }
};
