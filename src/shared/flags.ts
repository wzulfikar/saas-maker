type Flag = {
  enabled: boolean
  data?: Record<string, unknown>
}

// Module for type augmentation
// This is a declaration namespace that consumers will merge with
export namespace Flags {
  // Flag ID is intentionally declared as a generic string
  // Consumers should augment this in their own code
  export type FlagId = string;
}

// This interface will be available for module augmentation
interface Flags {
  can: <T extends string>(flagId: T, defaultValue?: boolean) => Promise<boolean>
  get: <T extends string, R extends Flag = Flag>(flagId: T, defaultValue?: R) => Promise<R>
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

/**
 * Feature flags utility with TypeScript declaration merging support.
 * 
 * To add type-safe flag IDs, use module augmentation:
 * 
 * ```typescript
 * // Augment the module to add your app's feature flags
 * declare module 'path/to/flags' {
 *   // Define your valid flag IDs as a union type
 *   export type AppFlagId = 'dark-mode' | 'premium-features' | 'new-dashboard';
 *   
 *   // Add type checking for your flags
 *   namespace Flags {
 *     export interface FlagTypes {
 *       'dark-mode': { enabled: boolean; data?: { version: number } };
 *       'premium-features': { enabled: boolean; data?: { tier: string } };
 *     }
 *   }
 * }
 * 
 * // Then use with type safety:
 * import { flags, type AppFlagId } from 'path/to/flags';
 * 
 * // Type-safe flag IDs
 * await flags.can('dark-mode' as AppFlagId); // Works with intellisense
 * await flags.can('invalid-flag' as AppFlagId); // TypeScript error
 * ```
 */
const flags: Flags = {
  can: async (flagId, defaultValue) => {
    const flag = await flags.get(flagId, { enabled: defaultValue ?? false } as Flag)
    return flag.enabled
  },
  get: async <T extends string, R extends Flag = Flag>(flagId: T, defaultValue?: R): Promise<R> => {
    let flag = flags.flags?.[flagId]
    if (typeof flag === 'undefined' && flags.fetchFlag) {
      flag = await flags.fetchFlag(flagId, flags.userId)
      flags.flags = { ...flags.flags, [flagId]: flag }
    }
    return (flag ?? defaultValue) as R
  }
};

export { flags }
export type { Flag, Flags }
