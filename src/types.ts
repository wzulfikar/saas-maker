export type DefaultErrorCodes =
  /** Errors for server-side flows */
  | 'API_ERROR'          // When calling an external API
  | 'INVALID_DATA_ERROR' // When a data has unexpected value
  | 'VALIDATION_ERROR'   // When validation error happens

  /** Error codes from throw utils */
  | 'INVALID_STATE_ERROR'    // When a variable is in an invalid (illegal) state. Thrown by `throwIfInvalid`
  | 'UNEXPECTED_FALSY_VALUE' // When a value is unexpectedly falsy. Thrown by `throwIfFalsy`
  | 'UNEXPECTED_NULL_VALUE'  // When a value is unexpectedly null. Thrown by `throwIfNull`
  | 'UNEXPECTED_NULL_RESULT' // When a result container has null data. Thrown by `throwOnNull`

  /** Error codes from API responses */
  | 'BAD_REQUEST'           // When a request is invalid (eg. invalid input)
  | 'UNAUTHENTICATED'       // When a request is not authenticated
  | 'UNAUTHORIZED'          // When a request is not authorized
  | 'RESOURCE_NOT_FOUND'    // When a resource is not found
  | 'INTERNAL_SERVER_ERROR' // When an internal server error occurs

export interface AppUserFields {
  default: DefaultAppUserFields
}

export interface ErrorCodes {
  default: DefaultErrorCodes | (string & {})
}

/**
 * Error codes from defautl errors. You can type your own errors via `merge` or `custom` field.
 */
export type ErrorCode =
  ErrorCodes extends { custom: infer CustomError } ? CustomError
  : ErrorCodes extends { extend: infer ExtendError } ? ErrorCodes['default'] | ExtendError
  : ErrorCodes extends { extendStrict: infer ExtendStrictError } ? DefaultErrorCodes | ExtendStrictError
  : ErrorCodes['default']

type Success<T> = { data: T; error: null }
type Failure<E> = { data: null; error: E }
export type Result<T, E = Error> = Success<T> | Failure<E>

export type Logger = {
  info: LoggerFn;
  warn: LoggerFn;
  error: LoggerFn;
  debug: LoggerFn;
}

export type LoggerFn = (...args: any[]) => void;

export type SeverityLevel = "debug" | "info" | "warning" | "error" | "fatal" & (string & {});

export type ReportErrorParams = {
  ctx?: string,
  level?: SeverityLevel
  userId?: string
}

export type ErrorReporterFn = (error: unknown, params?: ReportErrorParams) => Promise<void>

export interface ErrorReporter extends ErrorReporterFn {
  reporter?: string;
  customReporter?: ErrorReporterFn;
}

interface DefaultAppUserFields {
  /** Unique identifier for the user. This is the only required property for the user object. */
  id?: string;
  username?: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
  role?: string;
  customerId?: string;
  subscriptionPlan?: string;
  isConfirmed?: boolean;
  metadata?: Record<string, any>;
}

/**
 * The user object returned by the `fetchUser` function. Includes fields for:
 * - unique identifier (`id`)
 * - SaaS related info (`customerId`, `subscriptionPlan`)
 * - common info (`username`, `name`, `email`, `pictureUrl`, `role`)
 * - additional custom info (`metadata`).
 */
export type AppUser = AppUserFields extends { custom: infer CustomAppUser } ? CustomAppUser : AppUserFields["default"]
