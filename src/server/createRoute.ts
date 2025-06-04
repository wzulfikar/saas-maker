export function isRouteError(error: any): error is RouteError {
  return error instanceof RouteError ||
    (error && error.name === 'RouteError' && 'errorCode' in error);
}

type RouteInfo = {
  name?: string
  steps: string[]
  extends: string[]
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

// Enhanced route options with minimal framework integration
type RouteOptions = {
  name?: string
  onRequest?: (req: Request) => Promise<void | Response>
  onResponse?: (res: Response) => Promise<void | Response>
  onError?: (err: RouteError) => Promise<void | Response>
  requestObject?: (...args: unknown[]) => Request
}

// Context types for progressive building
type Context = Record<string, unknown>
type EmptyContext = {}
type MergeContexts<T, U> = T & U

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

const PREDEFINED_PARSE_FIELDS = ['headers', 'body', 'query', 'cookies', 'auth', 'resource', 'method', 'path'] as const

type PredefinedParseFields = typeof PREDEFINED_PARSE_FIELDS[number]

// Single-parameter parse payload with automatic literal type inference
type ParseFields<TContext> = {
  path?: string
  method?: RouteMethod | readonly RouteMethod[]
  auth?: (ctx: TContext & { request: Request, authHeader: string | null }) => Promise<unknown>
  headers?: (ctx: TContext & { request: Request, headers: Headers }) => Promise<unknown>
  cookies?: (ctx: TContext & { request: Request, cookies: Record<string, string> }) => Promise<unknown>
  body?: (ctx: TContext & { request: Request, body: Record<string, unknown> }) => Promise<unknown>
  query?: (ctx: TContext & { request: Request, query: Record<string, string> }) => Promise<unknown>
  resource?: (ctx: TContext & { request: Request, query: Record<string, string>, body: Record<string, unknown> }) => Promise<unknown>
};

/** Extract parse results from payload */
type ExtractParseResult<T> =
  (T extends { body?: (ctx: any) => Promise<infer B> } ? { body: B } : {}) &
  (T extends { query?: (ctx: any) => Promise<infer Q> } ? { query: Q } : {}) &
  (T extends { auth?: (ctx: any) => Promise<infer A> } ? { auth: A } : {}) &
  (T extends { headers?: (ctx: any) => Promise<infer H> } ? { headers: H } : {}) &
  (T extends { cookies?: (ctx: any) => Promise<infer C> } ? { cookies: C } : {}) &
  (T extends { resource?: (ctx: any) => Promise<infer R> } ? { resource: R } : {}) &
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
  private steps: { type: 'prepare' | 'parse', stepFn: StepFn, payload?: unknown }[] = []
  private currentStep: number = 0
  extends: string[] = []
  routeError?: RouteError

  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = routeOptions
  }

  extend<TNewContext extends Context>(opts?: { name?: string }) {
    const extendBuilder = new RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads>({
      ...this.routeOptions,
      ...opts,
    })
    extendBuilder.steps = [...this.steps]
    extendBuilder.extends = [...this.extends, this.routeOptions.name || '(no name)']
    return extendBuilder
  }

  prepare<TNewContext extends Context>(
    prepareFn: (ctx: { request: Request } & TContext) => Promise<TNewContext | undefined | void>
  ) {
    this.steps.push({ type: 'prepare', stepFn: prepareFn as StepFn })
    const builder = new RouteBuilder({ ...this.routeOptions })
    builder.steps = [...this.steps]
    return builder as RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads>
  }

  // Parse method with proper overloads
  parse<TFields extends ParseFields<TContext>>(
    fields: TFields
  ) {
    function parseQuery(ctx: { request: Request, query?: Record<string, string> }) {
      if (!ctx.query) {
        const url = new URL(ctx.request.url)
        ctx.query = Object.fromEntries(url.searchParams.entries())
      }
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
    }

    // Store the parse step for later execution
    this.steps.push({
      type: 'parse',
      payload: fields,
      stepFn: async (ctx) => {
        const parsedResults: Record<string, unknown> = {}
        const req = ctx.request

        for (const [key, value] of Object.entries(fields)) {
          const field = key as PredefinedParseFields
          if (typeof value === 'function' && PREDEFINED_PARSE_FIELDS.includes(field)) {
            try {
              let enhancedContext: Record<string, unknown>
              if (field === 'query') {
                parseQuery(ctx)
                enhancedContext = { ...ctx }
              } else if (field === 'body') {
                await parseBody(ctx)
                enhancedContext = { ...ctx }
              } else if (field === 'resource') {
                parseQuery(ctx)
                await parseBody(ctx)
                enhancedContext = { ...ctx }
              } else if (field === 'auth') {
                // Parse auth header
                const authHeader = req.headers.get('authorization')
                enhancedContext = { ...ctx, authHeader }
              } else if (field === 'headers') {
                enhancedContext = { ...ctx, headers: req.headers }
              } else if (field === 'cookies') {
                // Parse cookies
                const cookieHeader = req.headers.get('cookie') || ''
                const cookies = Object.fromEntries(
                  cookieHeader.split(';')
                    .map(c => c.trim().split('='))
                    .filter(([key, value]) => key && value !== undefined && key.length > 0)
                    .map(([key, value]) => [key, value || ''])
                )
                enhancedContext = { ...ctx, cookies }
              } else {
                enhancedContext = { ...ctx }
              }

              const result = await (value as (ctx: unknown) => Promise<unknown>)(enhancedContext)
              parsedResults[key] = result
            } catch (error) {
              throw new RouteError(`Bad Request: Error parsing \`${key}\``, {
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
              throw new RouteError("Bad Request: Error parsing `method`", {
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
              throw new RouteError("Bad Request: Error parsing `path`", {
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

    const builder = new RouteBuilder({ ...this.routeOptions })
    builder.steps = [...this.steps]
    return builder as RouteBuilder<ParseResult<TContext, TFields>, MergeParseFields<TAccumulatedPayloads, TFields>>
  }

  handle<TResponse>(
    handlerFn: (ctx: { request: Request } & TContext) => Promise<TResponse>
  ): RouteHandler<TContext, TResponse, TAccumulatedPayloads> {
    const { onRequest, onResponse, onError, requestObject } = this.routeOptions
    const routeBuilder = this

    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        let request
        try {
          request = requestObject ? requestObject(...args) : args[0] instanceof Request ? args[0] as Request : null
          if (!request) throw new Error('Invalid request object')
        } catch (error) {
          throw new RouteError("Bad Request: Invalid request object", {
            errorCode: 'REQUEST_MAPPING_ERROR',
            errorMessage: `Failed to extract Request object: ${(error as Error).message}`,
            httpStatus: 400,
            cause: error as Error
          })
        }

        if (onRequest) {
          const maybeEarlyResponse = await onRequest(request)
          // Short circuit if onRequest returns a response
          if (maybeEarlyResponse instanceof Response) {
            return maybeEarlyResponse as unknown as TResponse
          }
        }

        // Build context by executing prepare steps
        let context: { request: Request } & Context = { request }

        for (const step of routeBuilder.steps) {
          if (step.type === 'prepare') {
            try {
              const result = await step.stepFn(context)
              if (result && typeof result === 'object') {
                context = { ...context, ...result }
              }
            } catch (error) {
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Bad Request: Error when preparing request", {
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
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Bad Request: Error when parsing request", {
                  errorCode: 'PARSE_ERROR',
                  errorMessage: (error as Error).message,
                  httpStatus: 400,
                  cause: error as Error,
                })
              throw routeBuilder.routeError
            }
          }
          routeBuilder.currentStep++
        }

        // Clean context before passing to handler - remove internal cache properties
        // const cleanContext = { ...context }
        // delete cleanContext.body
        // delete cleanContext.query

        const response = await handlerFn(context as { request: Request } & TContext)
        const wrappedResponse = response instanceof Response
          ? response
          : new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        if (onResponse) {
          const customResponse = await onResponse(wrappedResponse)
          if (customResponse instanceof Response) {
            return customResponse as unknown as TResponse
          }
        }

        // TODO: fix test
        return wrappedResponse as unknown as TResponse
      } catch (error) {
        if (onError) {
          const err = error as RouteError
          (err as any).routeInfo = routeBuilder.getRouteInfo()
          const response = await onError(err)
          if (response instanceof Response) {
            // TODO: fix type. don't infer return value from happy path's type if there's error. should we add `errorValue`?
            return response as unknown as TResponse
          }
        }
        // Let user handle the error manually
        throw error
      }
    }

    routeHandler.invoke = async (contextOverride?: Partial<TContext>): Promise<TResponse> => {
      try {
        const mockRequest = new Request('http://localhost/invoke')
        let context: { request: Request } & Context = { request: mockRequest, ...contextOverride }

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
              routeBuilder.routeError = isRouteError(error)
                ? error
                : new RouteError("Bad Request: Error when parsing request", {
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
          routeBuilder.currentStep++
        }

        // Clean context before passing to handler - remove internal cache properties
        // const cleanContext = { ...context }
        // delete cleanContext.body
        // delete cleanContext.query

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
          const response = await onError(err)
          if (response instanceof Response) {
            return response as unknown as TResponse
          }
        }
        throw routeBuilder.routeError
      }
    }

    routeHandler.inferRouteType = {} as RouteTypeInfo<TContext, TResponse, TAccumulatedPayloads>
    return routeHandler as RouteHandler<TContext, TResponse, TAccumulatedPayloads>
  }

  getRouteInfo() {
    const steps = this.steps.map((step, i) => `${step.type}${i < this.currentStep ? ' (ok)' : i === this.currentStep ? ' (error)' : ''}`)
    return {
      name: this.routeOptions.name,
      steps: steps,
      extends: this.extends
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
    body: TAccumulatedPayloads extends { body: (ctx: any) => Promise<infer B> } ? B : undefined
    query: TAccumulatedPayloads extends { query: (ctx: any) => Promise<infer Q> } ? Q : undefined
  }
  returnValue: TResponse
} 
