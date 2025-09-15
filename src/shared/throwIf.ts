import { AppError, type AppErrorParams } from './error'

/**
 * Throws error if value is falsy
 */
export function throwIf(
  value: any,
  message: string,
  appErrorParams?: AppErrorParams,
) {
  if (value) throw new AppError(message, appErrorParams)
}
