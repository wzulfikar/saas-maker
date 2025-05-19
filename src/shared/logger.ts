import type { SeverityLevel } from "../types"

type LoggerFn = (msg: string, params?: object & {
  report?: boolean
}) => void

type LoggerReporterFn = (msg: string, params?: object & {
  level?: Exclude<SeverityLevel, "fatal">
}) => Promise<void>

type Logger = {
  info: LoggerFn
  error: LoggerFn
  warn: LoggerFn
  debug: LoggerFn
  reporter: LoggerReporterFn | undefined
}

const logger: Logger = {
  info: (msg, params) => {
    console.info(msg, params)
    logger.reporter?.(msg, { ...params, level: "info" })
  },
  error: (msg, params) => {
    console.error(msg, params)
    logger.reporter?.(msg, { ...params, level: "error" })
  },
  warn: (msg, params) => {
    console.warn(msg, params)
    logger.reporter?.(msg, { ...params, level: "warning" })
  },
  debug: (msg, params) => {
    console.debug(msg, params)
    logger.reporter?.(msg, { ...params, level: "debug" })
  },
  reporter: undefined as LoggerReporterFn | undefined,
};

export { logger }
