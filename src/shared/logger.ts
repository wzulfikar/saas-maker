import type { SeverityLevel } from "../types"

type LoggerLevel = Exclude<SeverityLevel, "fatal">

type LoggerFn = (msg: string, params?: Record<string, any> & {
  level?: LoggerLevel
  report?: boolean
}) => void

type LoggerReporterFn = (msg: string, params?: object & {
  level?: LoggerLevel
}) => Promise<void>

type Logger = {
  info: LoggerFn
  error: LoggerFn
  warn: LoggerFn
  debug: LoggerFn

  loggerFn: LoggerFn
  prefix?: '{level}' | '{timestamp}' | (string & {})
  reporter?: LoggerReporterFn | undefined
}

const msgWithPrefix = (msg: string, level: LoggerLevel, prefix: Logger["prefix"]) => {
  if (!prefix) return msg
  const parsedPrefix = prefix
    .replace('{level}', `[${level}]`)
    .replace('{timestamp}', `[${new Date().toISOString()}]`)
  return `${parsedPrefix} ${msg}`
}

const logger: Logger = {
  loggerFn: (msg, params) => {
    const { level = 'info', report, ...payload } = params || {}
    const consoleLevel = level === 'warning' ? 'warn' : level
    const defaultLogger = console[consoleLevel]
    defaultLogger(msgWithPrefix(msg, level, logger.prefix), JSON.stringify(payload))
    if (report) {
      if (logger.reporter) {
        logger.reporter(msg, { ...payload, level })
      } else {
        defaultLogger('[WARN] report is enabled but reporter is not set')
      }
    }
  },
  info: (msg, params) => logger.loggerFn(msg, { ...params, level: "info" }),
  error: (msg, params) => logger.loggerFn(msg, { ...params, level: "error" }),
  warn: (msg, params) => logger.loggerFn(msg, { ...params, level: "warning" }),
  debug: (msg, params) => logger.loggerFn(msg, { ...params, level: "debug" }),
};

export { logger }
