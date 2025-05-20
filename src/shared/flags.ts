export type Flag = {
  enabled: boolean
  data?: Record<string, unknown>
}

// Module for type augmentation
// This is a declaration namespace that consumers will merge with
export namespace FlagsNamespace{
  // Flag ID is intentionally declared as a generic string
  // Consumers should augment this in their own code
  export type FlagId = string;
}

// This interface will be available for module augmentation
export interface Flags {
  enabled: <T extends string>(flagId: T, defaultValue?: boolean) => boolean
  get: <T extends string, R extends Flag = Flag>(flagId: T, defaultValue?: R) => R
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
  enabled: (flagId, defaultValue) => {
    return flags.get(flagId, { enabled: defaultValue } as Flag).enabled
  },
  get: <T extends string, R extends Flag = Flag>(flagId: T, defaultValue?: R): R => {
    const flag = flags.flags?.[flagId]
    return (flag ?? defaultValue) as R
  }
};

export { flags }
