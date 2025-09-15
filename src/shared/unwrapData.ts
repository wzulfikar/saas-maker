import type { AppErrorParams } from "./error"
import { throwOnError } from "./throwOnError"
import { throwOnNull, type HasNullableData } from "./throwOnNull"

/**
 * Unwraps the data from the result container. Throws an error if the data is null
 * or the result contains an error.
 * 
 * Use this to handle result that may fail (ie. returns error) or return null value.
 * With `unwrapData`, the `data` property is guaranteed to be non-null and has no error.
 * 
 * The error message is based on this format:
 * - on error: `Error getting ${subject.toLowerCase()}`
 * - on null: `${subject} not found`
 * 
 * @param result - The result to unwrap.
 * @returns 
 */
export function unwrapData<T>(result: HasNullableData<T> & { error?: any }, subject: string, appErrorParams?: AppErrorParams): asserts result is {
  data: T
  error: null
} {
  throwOnError(result, `Error getting ${subject.toLowerCase()}`, appErrorParams)
  throwOnNull(result, `${subject} not found`, appErrorParams)
}
