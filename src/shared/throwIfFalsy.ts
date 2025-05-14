import { AppError, type AppErrorParams } from './error'

/**
 * Throws error if value is falsy
 */
export function throwIfFalsy<T>(
  value: T | null | undefined | boolean | string | number,
  message: string,
  appErrorParams?: AppErrorParams,
): asserts value is NonNullable<T> {
  if (
    value === null ||
    value === undefined ||
    value === false ||
    value === '' ||
    value === 0
  )
    throw new AppError(message, {
      errorCode: 'INVALID_DATA_ERROR',
      ...appErrorParams,
    })
}
