import { AppError, type AppErrorParams } from './error'

type ErrorType = Error | string | object

export type HasError =
  | { error?: ErrorType | null | undefined }
  | (object | { error: ErrorType })

type CanThrow<T> = () => T

/**
 * Throws error (`AppError`) if:
 * 1. The object has an error property, or
 * 2. The function throws an error
 * 
 * @example With objects:
 * ```
 * throwOnError({ error: "Something went wrong" }, "Operation failed");
 * ```
 * 
 * @example With functions (e.g. for validation):
 * ```
 * const data = throwOnError(() => schema.parse(input), "Invalid data");
 * ```
 */
export function throwOnError<T>(
  objOrFn: CanThrow<T>,
  message?: string,
  appErrorParams?: AppErrorParams,
): T;

export function throwOnError<T extends HasError>(
  objOrFn: T,
  message?: string,
  appErrorParams?: AppErrorParams,
): asserts objOrFn is T & { error: null | undefined };

export function throwOnError<T>(
  objOrFn: CanThrow<T> | HasError,
  message?: string,
  appErrorParams?: AppErrorParams,
): any {
  // Handle function case
  if (typeof objOrFn === 'function') {
    try {
      return objOrFn();
    } catch (error) {
      throw new AppError(message || 'Operation failed', {
        cause: error,
        ...appErrorParams,
      });
    }
  }

  // Handle object case
  const obj = objOrFn as HasError;
  if (!('error' in obj) || !obj.error) return;

  const appError = (errMessage: string) =>
    new AppError(errMessage, {
      cause: obj.error,
      ...appErrorParams,
    })

  if (message) throw appError(message)

  if (
    obj.error instanceof Error ||
    (typeof obj.error === 'object' && 'message' in obj.error)
  )
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    throw appError((obj.error as any).message)

  if (typeof obj.error === 'string') throw appError(obj.error)

  throw appError('Unknown error')
}
