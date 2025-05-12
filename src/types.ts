export type HttpStatus =
  // 1xx - Informational
  | '100' | '101' | '102' | '103'
  // 2xx - Success
  | '200' | '201' | '202' | '203' | '204' | '205' | '206' | '207' | '208' | '226'
  // 3xx - Redirection
  | '300' | '301' | '302' | '303' | '304' | '305' | '307' | '308'
  // 4xx - Client Error
  | '400' | '401' | '402' | '403' | '404' | '405' | '406' | '407' | '408' | '409'
  | '410' | '411' | '412' | '413' | '414' | '415' | '416' | '417' | '418' | '421'
  | '422' | '423' | '424' | '425' | '426' | '428' | '429' | '431' | '451'
  // 5xx - Server Error
  | '500' | '501' | '502' | '503' | '504' | '505' | '506' | '507' | '508' | '510' | '511'

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
