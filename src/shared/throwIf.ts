import { AppError, type AppErrorParams } from './error'

/**
 * Throws error if value is falsy
 */
export function throwIf<T>(
  value: T | null,
  message: string,
  appErrorParams?: AppErrorParams,
): asserts value is NonNullable<T> {
  if (!value) throw new AppError(message, appErrorParams)
}
