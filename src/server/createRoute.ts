export function isRouteError(error: any): error is RouteError {
  return error instanceof RouteError ||
    (error && error.name === 'RouteError' && 'errorCode' in error);
}

type RouteInfo = {
  name?: string
  extends: string[]
  steps: string[]
  requestFormat?: MapRequestObject['requestFormat']
}

type RequestWithPathParams = {
  request: Request,
  pathParams?: Record<string, unknown>
}

type MapRequestObject = RequestWithPathParams & {
  requestFormat?:
  | 'OBJECT'
  | 'OBJECT_WITH_PARAMS' // Example: Bun.serve
  | 'POSITIONAL_ARGS'
  | 'POSITIONAL_ARGS_WITH_PARAMS' // Example: Next.js App Route
  | (string & {}) // Slot for custom format provided by user
}

// RouteError class for structured error handling
export class RouteError extends Error {
  public readonly errorCode: string
  public readonly errorMessage: string
  public readonly httpStatus: number
  public readonly cause?: Error
  public readonly routeInfo?: RouteInfo

  constructor(
    message: string,
    options: {
      errorCode: string
      errorMessage: string
      httpStatus: number
      cause?: Error
      routeInfo?: RouteInfo
    }
  ) {
    super(message)
    this.name = 'RouteError'
    this.errorCode = options.errorCode
    this.errorMessage = options.errorMessage
    this.httpStatus = options.httpStatus
    this.cause = options.cause
    this.routeInfo = options.routeInfo
  }
}

export type ErrorHandler = (ctx: ErrorHandlerPayload) => Promise<void | Response> | void | Response

export type ErrorHandlerPayload = { error: RouteError } & RequestWithPathParams & Context

// Enhanced route options with minimal framework integration
type RouteOptions = {
  name?: string
  onRequest?: (ctx: RequestWithPathParams) => Promise<void | Response> | void | Response
  onResponse?: (ctx: RequestWithPathParams & Context & { response: Response }) => Promise<void | Response> | void | Response
  onError?: ErrorHandler
  requestObject?: (...args: unknown[]) => MapRequestObject
  requestFormat?: MapRequestObject['requestFormat']
  throwOnError?: boolean
}

// Context types for progressive building
type Context = Record<string, unknown>
type EmptyContext = {}
type MergeContexts<T, U> = T & U

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

const PREDEFINED_PARSE_FIELDS = ['headers', 'body', 'query', 'cookies', 'auth', 'resource', 'method', 'path'] as const

type PredefinedParseFields = typeof PREDEFINED_PARSE_FIELDS[number]

// Helper type to extract return type from both sync and async functions
type ExtractFunctionResult<T> =
  T extends (ctx: any) => Promise<infer R> ? R :
  T extends (ctx: any) => infer R ? R :
  never

// Parse fields with automatic literal type inference
type ParseFields<TContext> = {
  path?: string
  method?: RouteMethod | readonly RouteMethod[]
  auth?: (ctx: TContext & { request: Request, authHeader: string | null }) => Promise<unknown> | unknown
  headers?: (ctx: TContext & { request: Request, headers: Headers }) => Promise<unknown> | unknown
  cookies?: (ctx: TContext & { request: Request, cookies: Record<string, string> }) => Promise<unknown> | unknown
  body?: (ctx: TContext & { request: Request, body: Record<string, unknown> }) => Promise<unknown> | unknown
  query?: (ctx: TContext & { request: Request, query: Record<string, string> }) => Promise<unknown> | unknown
  resource?: (ctx: TContext & { request: Request }) => Promise<unknown> | unknown
};

/** Extract parse results from payload */
type ExtractParseResult<T> =
  (T extends { body?: infer F } ? F extends Function ? { body: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { query?: infer F } ? F extends Function ? { query: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { auth?: infer F } ? F extends Function ? { auth: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { headers?: infer F } ? F extends Function ? { headers: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { cookies?: infer F } ? F extends Function ? { cookies: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { resource?: infer F } ? F extends Function ? { resource: ExtractFunctionResult<F> } : {} : {}) &
  (T extends { method?: infer M } ?
    M extends readonly RouteMethod[] ? { method: M[number] } :
    M extends RouteMethod ? { method: M } :
    {} : {}) &
  (T extends { path?: infer P } ? P extends string ? { path: { matched: P, params: Record<string, unknown> } } : {} : {})

/**
 * Remove never fields from type
 **/
type ExcludeNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}

/**
 * "Last wins" type merger - correctly handles field-level replacement
 **/
type ParseContext<TExisting, TNew> = {
  [K in keyof TExisting | keyof TNew]: K extends keyof TNew
  ? TNew[K]
  : K extends keyof TExisting
  ? TExisting[K]
  : never
}

// Helper type for parse result merging
type ParseResult<TContext, TFields> = TContext extends { parsed: infer TExisting }
  ? Omit<TContext, 'parsed'> & { parsed: ParseContext<TExisting, ExcludeNever<ExtractParseResult<TFields>>> }
  : TContext & { parsed: ExcludeNever<ExtractParseResult<TFields>> }

// Helper type for accumulating parse payloads
type MergeParseFields<TExisting, TNew> = TExisting & TNew

type StepFn = (ctx: { request: Request } & Context) => Promise<unknown>

// Enhanced RouteBuilder that tracks parse payloads for type extraction
export class RouteBuilder<TContext = EmptyContext, TAccumulatedPayloads = {}> {
  private steps: (
    | { type: 'prepare' | 'parse', stepFn: StepFn, payload?: unknown }
    | { type: 'extend', payload: { name: string } }
    | { type: 'handle' }
  )[] = []
  private currentStep: Record<number, 'ok' | 'error' | ''> = {}
  private extends: string[] = []
  private routeError?: RouteError

  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = routeOptions || {}
  }

  extend<TNewContext extends Context>(opts: { name: string }) {
    const extendBuilder = new RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads>({
      ...this.routeOptions,
      ...opts,
    })
    extendBuilder.steps = [...this.steps, { type: 'extend', payload: { name: opts.name } }]
    extendBuilder.extends = this.routeOptions.name ? [...this.extends, this.routeOptions.name] : [...this.extends]
    return extendBuilder
  }

  prepare<TNewContext extends Context>(
    prepareFn: (ctx: { request: Request } & TContext) => Promise<TNewContext | undefined | void> | TNewContext | undefined | void
  ) {
    const builder = new RouteBuilder({ ...this.routeOptions })
    builder.steps = [...this.steps, { type: 'prepare', stepFn: prepareFn as StepFn }]
    builder.extends = [...this.extends]
    return builder as RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads>
  }

  // Parse method with proper overloads
  parse<TFields extends ParseFields<TContext>>(
    fields: TFields
  ) {
    const builder = new RouteBuilder({ ...this.routeOptions })
    builder.steps = [...this.steps]
    builder.extends = [...this.extends]
    builder.steps.push({
      type: 'parse',
      payload: fields,
      stepFn: async (ctx) => {
        const parsedResults: Record<string, unknown> = {}
        const req = ctx.request
        for (const [key, value] of Object.entries(fields)) {
          const field = key as PredefinedParseFields
          if (typeof value === 'function' && PREDEFINED_PARSE_FIELDS.includes(field)) {
            try {
              let newCtx: Record<string, unknown>
              if (field === 'query') {
                newCtx = parseQuery(ctx)
              } else if (field === 'body') {
                newCtx = await parseBody(ctx)
              } else if (field === 'resource') {
                newCtx = { ...ctx }
              } else if (field === 'auth') {
                newCtx = { ...ctx, authHeader: req.headers.get('authorization') }
              } else if (field === 'headers') {
                newCtx = { ...ctx, headers: req.headers }
              } else if (field === 'cookies') {
                newCtx = parseCookies(ctx)
              } else {
                newCtx = { ...ctx }
              }

              const result = await (value as (ctx: unknown) => Promise<unknown>)(newCtx)
              parsedResults[key] = result
            } catch (error) {
              throw new RouteError(`Error parsing \`${key}\``, {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: key === 'auth' ? 401 : key === 'method' ? 405 : key === 'path' ? 404 : 400,
                cause: error as Error
              })
            }
          } else if (key === 'method') {
            // Handle method validation
            const method = req.method as RouteMethod
            const allowedMethods = Array.isArray(value) ? value : [value as RouteMethod]
            if (!allowedMethods.includes(method)) {
              throw new RouteError("Error parsing `method`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: `Method ${method} not allowed. Expected: ${allowedMethods.join(', ')}`,
                httpStatus: 405,
                cause: new Error(`Method ${method} not allowed`)
              })
            }
            parsedResults.method = method
          } else if (key === 'path') {
            // Handle path validation
            const url = new URL(req.url)
            const requestPath = url.pathname
            const expectedPath = value as string
            if (requestPath !== expectedPath) {
              throw new RouteError("Error parsing `path`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: `Path ${requestPath} does not match expected path ${expectedPath}`,
                httpStatus: 404,
                cause: new Error('Path mismatch')
              })
            }
            parsedResults.path = { matched: expectedPath, params: {} }
          }
        }

        return parsedResults
      }
    })
    return builder as RouteBuilder<ParseResult<TContext, TFields>, MergeParseFields<TAccumulatedPayloads, TFields>>
  }

  handle<TResponse>(
    handlerFn: (ctx: { request: Request } & TContext) => Promise<TResponse> | TResponse
  ): RouteHandler<TContext, TResponse, TAccumulatedPayloads> {
    const { onRequest, onResponse, onError, requestObject } = this.routeOptions
    const routeBuilder = this
    routeBuilder.steps.push({ type: 'handle' })
    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      // Build context by executing prepare steps
      let requestObj = {} as MapRequestObject
      let context = {} as Context & RequestWithPathParams
      let stepCounter = 0
      try {
        try {
          requestObj = requestObject ? requestObject(...args) : mapRequestObject(...args)
          if (!requestObj.request || !(requestObj.request instanceof Request))
            throw new Error('Invalid request object')
          if (requestObj.pathParams && requestObj.pathParams !== null && typeof requestObj.pathParams !== 'object')
            throw new Error('Invalid path params')
        } catch (error) {
          routeBuilder.currentStep[routeBuilder.steps.length - 1] = 'error'
          throw new RouteError("Invalid request object", {
            errorCode: 'REQUEST_MAPPING_ERROR',
            errorMessage: `Failed to extract Request object: ${(error as Error).message}`,
            httpStatus: 400,
            cause: error as Error
          })
        }

        context.request = requestObj.request
        context.pathParams = requestObj.pathParams
        routeBuilder.routeOptions.requestFormat = requestObj.requestFormat

        if (onRequest) {
          const maybeEarlyResponse = await onRequest(context)
          // Short circuit if onRequest returns a response
          if (maybeEarlyResponse instanceof Response) {
            return maybeEarlyResponse as unknown as TResponse
          }
        }

        for (const step of routeBuilder.steps) {
          if (step.type === 'prepare') {
            try {
              const result = await step.stepFn(context)
              if (result && typeof result === 'object') {
                context = { ...context, ...result }
              }
            } catch (error) {
              routeBuilder.currentStep[stepCounter] = 'error'
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Error when preparing request", {
                  errorCode: 'PREPARE_ERROR',
                  errorMessage: (error as Error).message,
                  httpStatus: 400,
                  cause: error as Error,
                })
              throw routeBuilder.routeError
            }
          } else if (step.type === 'parse') {
            try {
              const result = await step.stepFn(context)
              if (result && typeof result === 'object') {
                if (!context.parsed) {
                  context.parsed = {}
                }
                const parsedContext = context.parsed as Record<string, unknown>
                const newResults = result as Record<string, unknown>

                for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                  // Last wins approach - simply overwrite
                  parsedContext[fieldName] = fieldResult
                }
                context.parsed = parsedContext
              }
            } catch (error) {
              routeBuilder.currentStep[stepCounter] = 'error'
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Error when parsing request", {
                  errorCode: 'PARSE_ERROR',
                  errorMessage: (error as Error).message,
                  httpStatus: 400,
                  cause: error as Error,
                })
              throw routeBuilder.routeError
            }
          }
          routeBuilder.currentStep[stepCounter] = 'ok'
          stepCounter++
        }

        const response = await handlerFn(context as RequestWithPathParams & TContext)
        const wrappedResponse = response instanceof Response
          ? response
          : new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        context.response = wrappedResponse

        if (onResponse) {
          const customResponse = await onResponse(context as RequestWithPathParams & { response: Response })
          if (customResponse instanceof Response) {
            routeBuilder.currentStep[routeBuilder.steps.length - 1] = 'ok'
            return customResponse as unknown as TResponse
          }
        }

        routeBuilder.currentStep[routeBuilder.steps.length - 1] = 'ok'
        return wrappedResponse as unknown as TResponse
      } catch (error) {
        routeBuilder.currentStep[routeBuilder.steps.length - 1] = 'error'
        if (onError) {
          const err = error as RouteError
          (err as any).routeInfo = routeBuilder.getRouteInfo()
          const response = await onError({ ...context, error: err })
          if (response instanceof Response) {
            // TODO: fix type. don't infer return value from happy path's type if there's error. should we add `errorValue`?
            return response as unknown as TResponse
          }
        }

        if (routeBuilder.routeOptions.throwOnError) {
          // Let user handle the error manually
          throw error
        }

        const err = error as RouteError
        const json = JSON.stringify({
          error: {
            message: `${err.message}: ${err.errorMessage}`,
            code: err.errorCode
          }
        })
        return new Response(json, { status: err.httpStatus }) as TResponse
      }
    }

    routeHandler.invoke = async (contextOverride?: Partial<TContext>): Promise<TResponse> => {
      const mockRequest = new Request('http://localhost/invoke')
      try {
        let context: { request: Request } & Context = { request: mockRequest, ...contextOverride }
        let stepCounter = 0
        for (const step of routeBuilder.steps) {
          if (step.type === 'parse' && !context?.skipParse) {
            try {
              const result = await step.stepFn(context)
              if (result && typeof result === 'object') {
                if (!context.parsed) {
                  context.parsed = {}
                }
                const parsedContext = context.parsed as Record<string, unknown>
                const newResults = result as Record<string, unknown>

                for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                  // Last wins approach - simply overwrite. Keep override from invoke if exists.
                  if (contextOverride && 'parsed' in contextOverride && fieldName in (contextOverride as any)?.parsed) continue
                  parsedContext[fieldName] = fieldResult
                }
                context.parsed = parsedContext
              }
            } catch (error) {
              routeBuilder.currentStep[stepCounter] = 'error'
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Error when parsing request", {
                  errorCode: 'PARSE_ERROR',
                  errorMessage: (error as Error).message,
                  httpStatus: 500,
                  cause: error as Error,
                })
              throw routeBuilder.routeError
            }
          } else if (step.type === 'prepare' && !context?.skipPrepare) {
            try {
              const result = await step.stepFn(context)
              if (result && typeof result === 'object') {
                // Override from invoke takes precedence over prepare step
                context = { ...result, ...context }
              }
            } catch (error) {
              routeBuilder.currentStep[stepCounter] = 'error'
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Internal Server Error: Error in prepare step", {
                  errorCode: 'PREPARE_ERROR',
                  errorMessage: (error as Error).message,
                  httpStatus: 500,
                  cause: error as Error,
                })
              throw routeBuilder.routeError
            }
          }
          routeBuilder.currentStep[stepCounter] = 'ok'
          stepCounter++
        }

        const response = await handlerFn(context as { request: Request } & TContext)
        return response
      } catch (error) {
        routeBuilder.routeError = isRouteError(error)
          ? error
          : new RouteError("Internal Server Error", {
            errorCode: 'HANDLER_ERROR',
            errorMessage: (error as Error).message,
            httpStatus: 500,
            cause: error as Error,
          })
        if (onError) {
          const err = error as RouteError
          (err as any).routeInfo = routeBuilder.getRouteInfo()
          // TODO: handle `pathParams` in .invoke
          const response = await onError({ request: mockRequest, pathParams: undefined, error: err })
          if (response instanceof Response) {
            return response as unknown as TResponse
          }
        }
        throw routeBuilder.routeError
      }
    }

    routeHandler.inferRouteType = {} as RouteTypeInfo<TContext, TResponse, TAccumulatedPayloads>

    routeHandler.getRouteInfo = () => routeBuilder.getRouteInfo()

    return routeHandler as RouteHandler<TContext, TResponse, TAccumulatedPayloads>
  }

  getRouteInfo() {
    const steps = [
      '→ createRoute',
      ...this.steps.map((step, i) => {
        if (step.type === 'extend') return `→ ${step.payload.name}`
        return `${step.type}${this.currentStep[i] ? ` (${this.currentStep[i]})` : ''}`
      })
    ]
    return {
      name: this.routeOptions.name,
      extends: this.extends,
      steps: steps,
      requestFormat: this.routeOptions.requestFormat,
    }
  }
}

// Enhanced createRoute with single-parameter approach
export const createRoute = (routeOptions: RouteOptions = {}) => {
  return new RouteBuilder<EmptyContext, {}>(routeOptions)
}

// Enhanced route handler interface
interface RouteHandler<TContext, TResponse, TAccumulatedPayloads = {}> {
  (...args: unknown[]): Promise<TResponse>
  getRouteInfo(): RouteInfo
  invoke(contextOverride?: Partial<TContext>): Promise<TResponse>
  inferRouteType: RouteTypeInfo<TContext, TResponse, TAccumulatedPayloads>
}

// Path parameter extraction helper
type ExtractPathParams<T extends string> =
  T extends `${infer Start}/[${infer Param}]${infer Rest}`
  ? { [K in Param]: string } & ExtractPathParams<`${Start}${Rest}`>
  : T extends `${infer Start}/[${infer Param}]`
  ? { [K in Param]: string }
  : {}

// Transform path parameters from [param] to ${string} for API client types
type TransformPathParams<T extends string> =
  T extends `${infer Start}[${infer Param}]${infer Rest}`
  ? `${Start}${string}${TransformPathParams<Rest>}`
  : T

// Enhanced route type extraction with automatic literal type inference
type RouteTypeInfo<TContext, TResponse, TAccumulatedPayloads = {}> = {
  path: TAccumulatedPayloads extends { path: infer P }
  ? P extends string
  ? P extends `${string}[${string}]${string}`
  ? TransformPathParams<P>  // Transform [id] to ${string}
  : P  // Keep literal for simple paths
  : string
  : string
  pathParams: TAccumulatedPayloads extends { path: infer P }
  ? P extends string
  ? P extends `${string}[${string}]${string}`
  ? ExtractPathParams<P>
  : {}
  : never
  : {}
  method: TAccumulatedPayloads extends { method: infer M }
  ? M extends readonly RouteMethod[]
  ? M[number]
  : M extends RouteMethod
  ? M
  : string
  : string
  input: {
    body: TAccumulatedPayloads extends { body: infer F } ? F extends Function ? ExtractFunctionResult<F> : undefined : undefined
    query: TAccumulatedPayloads extends { query: infer F } ? F extends Function ? ExtractFunctionResult<F> : undefined : undefined
  }
  returnValue: TResponse
}

// 
// internal helpers
// 

/**
 * Map request object to a format used in popular frameworks.
 */
function mapRequestObject(...handlerArgs: any[]): MapRequestObject {
  const [firstArg, secondArg, ..._] = handlerArgs
  if (firstArg instanceof Request) {
    if (secondArg !== null && typeof secondArg === 'object') {
      return { request: firstArg, pathParams: secondArg, requestFormat: 'POSITIONAL_ARGS_WITH_PARAMS' }
    }
    return { request: firstArg, requestFormat: 'POSITIONAL_ARGS' }
  }
  if (typeof firstArg === 'object' && ('request' in firstArg || 'req' in firstArg)) {
    const request = firstArg.request instanceof Request
      ? firstArg.request
      : firstArg.req instanceof Request
        ? firstArg.req
        : null
    if (request) {
      if ('params' in firstArg) {
        return { request, pathParams: firstArg.params, requestFormat: 'OBJECT_WITH_PARAMS' }
      }
      return { request, requestFormat: 'OBJECT' }
    }
  }
  throw new Error('Error mapping request object with the default `mapRequestObject`')
}

function parseQuery(ctx: { request: Request, query?: Record<string, string> }) {
  if (!ctx.query) {
    const url = new URL(ctx.request.url)
    ctx.query = Object.fromEntries(url.searchParams.entries())
  }
  return ctx
}

async function parseBody(ctx: { request: Request, body?: Record<string, unknown> }) {
  // Parse and cache body data. TODO: handle multipart/form-data, etc.
  if (!ctx.body) {
    const bodyText = await ctx.request.text()
    if (bodyText.trim() === '') {
      ctx.body = {}
    } else {
      try {
        ctx.body = JSON.parse(bodyText) as Record<string, unknown>
      } catch {
        ctx.body = { text: bodyText }
      }
    }
  }
  return ctx
}

function parseCookies(ctx: { request: Request }) {
  const cookieHeader = ctx.request.headers.get('cookie')
  if (!cookieHeader) return { ...ctx, cookies: {} }
  const cookies = Object.fromEntries(
    cookieHeader.split(';')
      .map(c => c.trim().split('='))
      .filter(([key, value]) => key && value !== undefined && key.length > 0)
      .map(([key, value]) => [key, value || ''])
  )
  return { ...ctx, cookies }
}
