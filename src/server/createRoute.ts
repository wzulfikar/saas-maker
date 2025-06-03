// RouteError class for structured error handling
export class RouteError extends Error {
  public readonly errorCode: string
  public readonly errorMessage: string
  public readonly httpStatus: number
  public readonly cause?: Error

  constructor(
    message: string,
    options: {
      errorCode: string
      errorMessage: string
      httpStatus: number
      cause?: Error
    }
  ) {
    super(message)
    this.name = 'RouteError'
    this.errorCode = options.errorCode
    this.errorMessage = options.errorMessage
    this.httpStatus = options.httpStatus
    this.cause = options.cause
  }
}

// Enhanced route options with minimal framework integration
type RouteOptions = {
  onRequest?: (req: Request) => Promise<void | Response>
  onResponse?: (res: Response) => Promise<void | Response>
  // TODO: update tests then remove Error, throw RouteError instead
  onError?: (err: Error) => Promise<void | Response>
  requestObject?: (...args: unknown[]) => Request
}

// Context types for progressive building
type EmptyContext = {}
type MergeContexts<T, U> = T & U

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

const PREDEFINED_PARSE_FIELDS = ['headers', 'body', 'query', 'cookies', 'auth', 'method', 'path'] as const

type PredefinedParseFields = typeof PREDEFINED_PARSE_FIELDS[number]

// Single-parameter parse payload with automatic literal type inference
type SingleParamParsePayload<TContext> = {
  path?: string
  method?: RouteMethod | readonly RouteMethod[]
  auth?: (ctx: TContext & { authHeader: string | null }) => Promise<unknown>
  headers?: (ctx: TContext & { headers: Headers }) => Promise<unknown>
  cookies?: (ctx: TContext & { cookies: Record<string, string> }) => Promise<unknown>
  body?: (ctx: TContext & { body: Record<string, unknown> }) => Promise<unknown>
  query?: (ctx: TContext & { query: Record<string, string> }) => Promise<unknown>
};

// Type to extract parse results from single-param payload with proper inference
type ExtractSingleParamResults<T> =
  (T extends { body?: (ctx: any) => Promise<infer B> } ? { body: B } : {}) &
  (T extends { query?: (ctx: any) => Promise<infer Q> } ? { query: Q } : {}) &
  (T extends { auth?: (ctx: any) => Promise<infer A> } ? { auth: A } : {}) &
  (T extends { headers?: (ctx: any) => Promise<infer H> } ? { headers: H } : {}) &
  (T extends { cookies?: (ctx: any) => Promise<infer C> } ? { cookies: C } : {}) &
  (T extends { method?: infer M } ?
    M extends readonly RouteMethod[] ? { method: M[number] } :
    M extends RouteMethod[] ? { method: M[number] } :
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
type ParseResult<TContext, TPayload> = TContext extends { parsed: infer TExisting }
  ? Omit<TContext, 'parsed'> & { parsed: ParseContext<TExisting, ExcludeNever<ExtractSingleParamResults<TPayload>>> }
  : TContext & { parsed: ExcludeNever<ExtractSingleParamResults<TPayload>> }

// Helper type for accumulating parse payloads
type AccumulatePayloads<TExisting, TNew> = TExisting & TNew

type StepFn = (req: Request, ctx: unknown) => Promise<unknown>

// Enhanced RouteBuilder that tracks parse payloads for type extraction
export class RouteBuilder<TContext = EmptyContext, TAccumulatedPayloads = {}> {
  private steps: { type: 'prepare' | 'parse', stepFn: StepFn, payload?: unknown }[] = []

  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = routeOptions
  }

  prepare<TNewContext extends Record<string, unknown>>(
    prepareFn: (req: Request, ctx: TContext) => Promise<TNewContext | undefined | void>
  ): RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads> {
    this.steps.push({ type: 'prepare', stepFn: prepareFn as StepFn })
    const newBuilder = new RouteBuilder<MergeContexts<TContext, TNewContext>, TAccumulatedPayloads>(this.routeOptions)
    newBuilder.steps = [...this.steps]
    return newBuilder
  }

  // Parse method with proper overloads
  parse<TPayload extends SingleParamParsePayload<TContext>>(
    payload: TPayload
  ): RouteBuilder<ParseResult<TContext, TPayload>, AccumulatePayloads<TAccumulatedPayloads, TPayload>> {
    // Store the parse step for later execution
    this.steps.push({
      type: 'parse',
      payload,
      stepFn: async (req: Request, ctx: unknown) => {
        const parsedResults: Record<string, unknown> = {}
        const context = ctx as Record<string, unknown> & {
          _bodyCache?: unknown,
          _queryCache?: Record<string, string>
        }

        for (const [key, value] of Object.entries(payload)) {
          const fieldToParse = key as PredefinedParseFields
          if (typeof value === 'function' && PREDEFINED_PARSE_FIELDS.includes(fieldToParse)) {
            try {
              let enhancedContext: Record<string, unknown>

              if (fieldToParse === 'body') {
                // Parse and cache body data
                let bodyData: Record<string, unknown>
                if (context._bodyCache !== undefined) {
                  bodyData = context._bodyCache as Record<string, unknown>
                } else {
                  const bodyText = await req.text()
                  if (bodyText.trim() === '') {
                    bodyData = {}
                  } else {
                    try {
                      bodyData = JSON.parse(bodyText) as Record<string, unknown>
                    } catch {
                      bodyData = { text: bodyText }
                    }
                  }
                  context._bodyCache = bodyData
                }
                enhancedContext = { ...(ctx as Record<string, unknown>), body: bodyData }
              } else if (fieldToParse === 'query') {
                // Parse and cache query data
                let queryData: Record<string, string>
                if (context._queryCache !== undefined) {
                  queryData = context._queryCache
                } else {
                  const url = new URL(req.url)
                  queryData = Object.fromEntries(url.searchParams.entries())
                  context._queryCache = queryData
                }
                enhancedContext = { ...(ctx as Record<string, unknown>), query: queryData }
              } else if (fieldToParse === 'auth') {
                // Parse auth header
                const authHeader = req.headers.get('authorization')
                enhancedContext = { ...(ctx as Record<string, unknown>), authHeader }
              } else if (fieldToParse === 'headers') {
                enhancedContext = { ...(ctx as Record<string, unknown>), headers: req.headers }
              } else if (fieldToParse === 'cookies') {
                // Parse cookies
                const cookieHeader = req.headers.get('cookie') || ''
                const cookies = Object.fromEntries(
                  cookieHeader.split(';')
                    .map(c => c.trim().split('='))
                    .filter(([key, value]) => key && value !== undefined && key.length > 0)
                    .map(([key, value]) => [key, value || ''])
                )
                enhancedContext = { ...(ctx as Record<string, unknown>), cookies }
              } else {
                enhancedContext = { ...(ctx as Record<string, unknown>) }
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
          } else if (typeof value === 'function') {
            // Handle custom fields - they get ctx.request  
            try {
              const enhancedContext = { ...(ctx as Record<string, unknown>), request: req }
              const result = await (value as (ctx: unknown) => Promise<unknown>)(enhancedContext)
              parsedResults[key] = result
            } catch (error) {
              throw new RouteError(`Bad Request: Error parsing \`${key}\``, {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }
        }

        return parsedResults
      }
    })

    // Create new builder with merged parsed context
    const newBuilder = new RouteBuilder<ParseResult<TContext, TPayload>, AccumulatePayloads<TAccumulatedPayloads, TPayload>>(this.routeOptions)
    newBuilder.steps = [...this.steps]

    return newBuilder
  }

  handle<TResponse>(
    handlerFn: (req: Request, ctx: TContext) => Promise<TResponse>
  ): EnhancedRouteHandler<TContext, TResponse, TAccumulatedPayloads> {
    const { onRequest, onResponse, onError, requestObject } = this.routeOptions
    const steps = this.steps

    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        let request: Request
        try {
          request = args[0] instanceof Request ? args[0] as Request : requestObject?.(...args) as Request
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
        let context: Record<string, unknown> = {}
        let count = 0

        for (const step of steps) {
          if (step.type === 'prepare') {
            try {
              const result = await step.stepFn(request, context)
              if (result && typeof result === 'object') {
                context = { ...context, ...result }
              }
            } catch (error) {
              if (error instanceof RouteError) {
                throw error
              }
              throw new RouteError("Bad Request: Error preparing request handler", {
                errorCode: 'PREPARE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          } else if (step.type === 'parse') {
            try {
              const result = await step.stepFn(request, context)
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
              if (error instanceof RouteError) {
                throw error
              }
              throw new RouteError("Bad Request: Error parsing request", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }
        }

        // Clean context before passing to handler - remove internal cache properties
        const cleanContext = { ...context }
        delete cleanContext._bodyCache
        delete cleanContext._queryCache

        const response = await handlerFn(request, cleanContext as TContext)
        const wrappedResponse = response instanceof Response
          ? response
          : new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })

        if (onResponse) {
          let responseForHook: Response
          if (response instanceof Response) {
            responseForHook = response
          } else {
            responseForHook = new Response(JSON.stringify(response), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          const maybeCustomResponse = await onResponse(responseForHook)
          if (maybeCustomResponse instanceof Response) {
            return maybeCustomResponse as unknown as TResponse
          }
        }

        // TODO: fix test
        return wrappedResponse as unknown as TResponse
      } catch (error) {
        if (onError) {
          const response = await onError(error as Error)
          if (response instanceof Response) {
            // TODO: fix type. don't infer return value from happy path's type if there's error. should we add `errorValue`?
            return response as unknown as TResponse
          }
        }
        // Let user handle the error manually
        throw error
      }
    }

    // Enhanced invoke method
    routeHandler.invoke = async (contextOverride?: Partial<TContext>): Promise<TResponse> => {
      try {
        const mockRequest = new Request('http://localhost/invoke')
        let context: Record<string, unknown> = { ...contextOverride }

        for (const step of steps) {
          if (step.type === 'parse' && !context?.skipParse) {
            try {
              const result = await step.stepFn(mockRequest, context)
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
              if (error instanceof RouteError) {
                throw error
              }
              throw new RouteError("Internal Server Error: Error in parse step", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 500,
                cause: error as Error
              })
            }
          } else if (step.type === 'prepare' && !context?.skipPrepare) {
            try {
              const result = await step.stepFn(mockRequest, context)
              if (result && typeof result === 'object') {
                // Override from invoke takes precedence over prepare step
                context = { ...result, ...context }
              }
            } catch (error) {
              if (error instanceof RouteError) {
                throw error
              }
              throw new RouteError("Internal Server Error: Error in prepare step", {
                errorCode: 'PREPARE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 500,
                cause: error as Error
              })
            }
          }
        }

        // Clean context before passing to handler - remove internal cache properties
        const cleanContext = { ...context }
        delete cleanContext._bodyCache
        delete cleanContext._queryCache

        return await handlerFn(mockRequest, cleanContext as TContext)
      } catch (error) {
        if (onError) {
          await onError(error as Error)
        }
        if (error instanceof RouteError) {
          throw error
        }
        throw new RouteError("Internal Server Error", {
          errorCode: 'HANDLER_ERROR',
          errorMessage: (error as Error).message,
          httpStatus: 500,
          cause: error as Error
        })
      }
    }

    routeHandler.inferRouteType = {} as RouteTypeInfo<TContext, TResponse, TAccumulatedPayloads>
    return routeHandler as EnhancedRouteHandler<TContext, TResponse, TAccumulatedPayloads>
  }
}

// Enhanced createRoute with single-parameter approach
export const createRoute = (routeOptions: RouteOptions = {}) => {
  return new RouteBuilder<EmptyContext, {}>(routeOptions)
}

// Enhanced route handler interface
interface EnhancedRouteHandler<TContext, TResponse, TAccumulatedPayloads = {}> {
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
