export type Flag = {
  enabled: boolean
  data?: Record<string, unknown>
}

// biome-ignore lint/suspicious/noEmptyInterface: <explanation>
export interface FlagIds {
}

type FlagId = FlagIds extends { id: infer U } ? U : string

// This interface will be available for module augmentation
export interface Flags {
  enabled: <T extends FlagId>(flagId: T, defaultValue?: boolean) => boolean
  get: <T extends FlagId, R extends Flag = Flag>(flagId: T, defaultValue?: R) => R
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

const flags: Flags = {
  enabled: <T extends FlagId>(flagId: T, defaultValue?: boolean): boolean => {
    return flags.get(flagId, { enabled: defaultValue } as Flag).enabled
  },
  get: <T extends FlagId, R extends Flag = Flag>(flagId: T, defaultValue?: R): R => {
    const flag = flags.flags?.[flagId as keyof typeof flags.flags]
    return (flag ?? defaultValue) as R
  }
};

export { flags }
