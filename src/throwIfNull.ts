import { AppError, type AppErrorParams } from './error'

/**
 * Throws error if value is falsy
 */
export function throwIfNull<T>(
  value: T | null,
  message: string,
  appErrorParams?: AppErrorParams,
): asserts value is NonNullable<T> {
  if (value === null)
    throw new AppError(message, {
      errorCode: 'INVALID_DATA_ERROR',
      ...appErrorParams,
    })
}
