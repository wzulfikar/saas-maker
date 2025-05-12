import { AppError, type AppErrorParams } from './error'

/**
 * Throws error if value is null or undefined
 */
export function throwIfInvalid<T>(
  value: T | null | undefined,
  message: string,
  appErrorParams?: AppErrorParams,
): asserts value is NonNullable<T> {
  if (
    (Array.isArray(value) && value.length === 0) ||
    value === null ||
    value === undefined ||
    value === ''
  )
    throw new AppError(message, {
      errorCode: 'INVALID_STATE_ERROR',
      ...appErrorParams,
    })
}
