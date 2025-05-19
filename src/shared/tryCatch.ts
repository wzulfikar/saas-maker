import type { Result } from '../types'

export function tryCatch<T, E = Error>(fn: () => T): Result<T, E>;

export function tryCatch<T, E = Error>(promise: Promise<T>): Promise<Result<T, E>>;

export function tryCatch<T, E = Error>(input: Promise<T> | (() => T)): Promise<Result<T, E>> | Result<T, E> {
  if (typeof input === 'function') {
    try {
      return { data: input(), error: null }
    } catch (error) {
      return { data: null, error: error as E }
    }
  }
  return input
    .then(data => ({ data, error: null }))
    .catch(error => ({ data: null, error: error as E }))
}
