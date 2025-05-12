import type { DefaultErrorCodes, HttpStatus } from "./types"

/**
 * Error codes from common errors or any string (helps with autocompletion)
 */
export type ErrorCode = DefaultErrorCodes | (string & {})

export type AppErrorParams = {
  errorCode?: ErrorCode
  cause?: unknown
  report?: boolean
  skipLog?: boolean
  /* Only applicable in server side */
  httpStatus?: HttpStatus
}

export class AppError extends Error {
  prettyLog: string
  errorCode?: ErrorCode
  report?: boolean
  skipLog?: boolean
  httpStatus?: HttpStatus

  constructor(
    message: string,
    params?: AppErrorParams,
  ) {
    super(message, { cause: params?.cause })
    this.name = 'AppError'
    this.errorCode = params?.errorCode
    this.httpStatus = params?.httpStatus
    this.report = params?.report
    this.skipLog = params?.skipLog
    this.prettyLog = this.getLogMessage()
  }

  getLogMessage() {
    let errorLog = `[AppError] "${this.message}"`
    if (this.errorCode) errorLog += ` | code: ${this.errorCode}`
    if (this.httpStatus) errorLog += ` | httpStatus: ${this.httpStatus}`
    if (this.report) errorLog += ` | report: ${this.report}`
    return errorLog
  }
}

export type ErrorInfo = {
  message: string
  code?: string
  report?: boolean
  /**
   * Only applicable when passing AppError in server codes
   */
  httpStatus?: HttpStatus
}

/**
 * Get the error info from an AppError. Returns null if the error is not an AppError.
 */
export const getErrorInfo = (error: unknown): ErrorInfo | null => {
  if (error instanceof AppError) {
    return {
      code: error.errorCode,
      message: error.message,
      report: error.report,
      httpStatus: error.httpStatus,
    }
  }
  return null
}
