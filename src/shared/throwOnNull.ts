import { AppError, type AppErrorParams } from './error'

export interface HasNullableData<T = Record<string, unknown>> {
  data: T | null
  error?: unknown
}

/**
 * Throws error (`AppError`) if the object has `data` property that is `null`
 */
export function throwOnNull<T>(
  obj: HasNullableData<T>,
  /**
   * Message to include in the error. Should be safe to display to users.
   */
  message: string,
  appErrorParams?: AppErrorParams,
): asserts obj is { data: NonNullable<T>; error: null } {
  if (obj.data === null) {
    throw new AppError(message, {
      errorCode: 'UNEXPECTED_NULL_RESULT',
      cause: obj,
      ...appErrorParams,
    })
  }
}
