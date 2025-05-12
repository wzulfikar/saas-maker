import { AppError, type AppErrorParams } from './error'

interface HasData<T = Record<string, unknown>> {
  data: T | null
  error?: unknown
}

/**
 * Throws error (`AppError`) if the object has `data` property that is `null`
 */
export function throwOnNull<T>(
  obj: HasData<T>,
  /**
   * Message to include in the error. Should be safe to display to users.
   */
  message: string,
  appErrorParams?: AppErrorParams,
): asserts obj is { data: NonNullable<T>; error: null } {
  if (obj?.error || !obj?.data) {
    throw new AppError(message, {
      errorCode: 'DATA_NOT_FOUND_ERROR',
      ...appErrorParams,
    })
  }
}
