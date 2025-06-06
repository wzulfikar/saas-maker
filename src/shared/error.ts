import type { ErrorCode } from "../types"

export type AppErrorParams = {
  errorCode?: ErrorCode
  cause?: unknown
  report?: boolean
  /* Only applicable in server side */
  httpStatus?: number
}

export class AppError extends Error {
  prettyLog: string
  errorCode?: ErrorCode
  report?: boolean
  httpStatus?: number

  static logger?: ({ error, message }: { error: AppError, message: string }) => void

  constructor(
    message: string,
    params?: AppErrorParams,
  ) {
    super(message, { cause: params?.cause })
    this.name = 'AppError'
    this.errorCode = params?.errorCode
    this.httpStatus = params?.httpStatus
    this.report = params?.report
    this.prettyLog = formatAppError(this)
    if (AppError.logger) AppError.logger({ error: this, message: this.prettyLog })
  }
}

export function formatAppError(error: AppError) {
  let errorLog = `[AppError] error: "${error.message}"`
  if (error.errorCode) errorLog += ` | code: ${error.errorCode}`
  if (error.httpStatus) errorLog += ` | httpStatus: ${error.httpStatus}`
  if (error.report) errorLog += ` | report: ${error.report}`
  if (error.cause) errorLog += ` | cause: ${JSON.stringify(error.cause)}`
  return errorLog
}

export type ErrorInfo = {
  message: string
  code?: string
  report?: boolean
  /**
   * Only applicable when passing AppError in server codes
   */
  httpStatus?: number
}

/**
 * Get the error info from an AppError. Returns null if the error is not an AppError.
 */
export const getErrorInfo = (error: any): ErrorInfo | null => {
  if (error && (error.name === 'AppError' || error instanceof AppError)) {
    return {
      code: error.errorCode,
      message: error.message,
      report: error.report,
      httpStatus: error.httpStatus,
    }
  }
  return null
}
