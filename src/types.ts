export type DefaultErrorCodes =
  // Errors for server-side flows
  /** when calling an external API */
  | 'API_ERROR'
  /** when `data` from a result container does not exist */
  | 'RESOURCE_NOT_FOUND'
  /** when a variable or flow is in an invalid (illegal) state */
  | 'INVALID_STATE_ERROR'
  /** when a data has unexpected value */
  | 'INVALID_DATA_ERROR'
  /** when validation error happens (eg. via parseOrFail) */
  | 'VALIDATION_ERROR'

  // Errors for API responses
  /** when a request is invalid (eg. invalid input) */
  | 'BAD_REQUEST'
  /** when a request is not authenticated */
  | 'UNAUTHENTICATED'
  /** when a request is not authorized */
  | 'UNAUTHORIZED'
  /** when an internal server error occurs */
  | 'INTERNAL_SERVER_ERROR'

type Success<T> = { data: T; error: null }
type Failure<E> = { data: null; error: E }
export type Result<T, E = Error> = Success<T> | Failure<E>
