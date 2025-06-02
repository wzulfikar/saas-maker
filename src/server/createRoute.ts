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
  onRequest?: (req: Request) => Promise<void>
  onResponse?: (res: Response) => Promise<void>
  onError?: (err: Error) => Promise<void>
  requestObject?: (args: unknown) => Request
}

// Context types for progressive building
type EmptyContext = Record<string, unknown>
type MergeContexts<T, U> = T & U

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

// Single-parameter parse payload - the key insight that eliminates overload resolution issues
type SingleParamParsePayload<TContext> = {
  body?: (ctx: TContext & { body: Record<string, unknown> }) => Promise<unknown>
  query?: (ctx: TContext & { query: Record<string, string> }) => Promise<unknown>
  auth?: (ctx: TContext & { authHeader: string }) => Promise<unknown>
  headers?: (ctx: TContext & { headers: Headers }) => Promise<unknown>
  cookies?: (ctx: TContext & { cookies: Record<string, string> }) => Promise<unknown>
  method?: RouteMethod | RouteMethod[]
  path?: string
}

// Type to extract parse results from single-param payload with proper inference
type ExtractSingleParamResults<T> = 
  (T extends { body?: (ctx: any) => Promise<infer B> } ? { body: B } : {}) &
  (T extends { query?: (ctx: any) => Promise<infer Q> } ? { query: Q } : {}) &
  (T extends { auth?: (ctx: any) => Promise<infer A> } ? { auth: A } : {}) &
  (T extends { headers?: (ctx: any) => Promise<infer H> } ? { headers: H } : {}) &
  (T extends { cookies?: (ctx: any) => Promise<infer C> } ? { cookies: C } : {}) &
  (T extends { method?: infer M } ? M extends RouteMethod | RouteMethod[] ? { method: M } : {} : {}) &
  (T extends { path?: infer P } ? P extends string ? { path: { matched: P, params: Record<string, unknown> } } : {} : {}) &
  // Handle custom fields by extracting all non-predefined function properties
  {
    [K in keyof T as K extends 'body' | 'query' | 'auth' | 'headers' | 'cookies' | 'method' | 'path' 
      ? never 
      : T[K] extends (ctx: any) => Promise<any> 
        ? K 
        : never
    ]: T[K] extends (ctx: any) => Promise<infer R> ? R : never
  }

// Remove never fields from type
type RemoveNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}

// Framework adapters
const FrameworkAdapters = {
  auto: (args: unknown) => {
    if (args && typeof args === 'object' && (args as Record<string, unknown>).method && (args as Record<string, unknown>).url) {
      return args as Request
    }
    if (Array.isArray(args) && args[0]) {
      const first = args[0]
      if (first && typeof first === 'object' && (first as Record<string, unknown>).method && (first as Record<string, unknown>).url) {
        return first as Request
      }
    }
    return args as Request
  }
} as const

// Enhanced createRoute with single-parameter approach
export const createRoute = (routeOptions: RouteOptions = {}) => {
  return new RouteBuilder<EmptyContext>(routeOptions)
}

export class RouteBuilder<TContext = EmptyContext> {
  private prepareSteps: Array<(req: Request, ctx: unknown) => Promise<unknown>> = []
  private parseSteps: Array<{
    payload: unknown
    parseFn: (req: Request, ctx: unknown) => Promise<unknown>
  }> = []

  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = {
      requestObject: routeOptions.requestObject || FrameworkAdapters.auto,
      ...routeOptions
    }
  }

  prepare<TNewContext extends Record<string, unknown>>(
    prepareFunction: (req: Request, ctx: TContext) => Promise<TNewContext | undefined>
  ): RouteBuilder<MergeContexts<TContext, TNewContext>> {
    this.prepareSteps.push(prepareFunction as (req: Request, ctx: unknown) => Promise<unknown>)
    const newBuilder = new RouteBuilder<MergeContexts<TContext, TNewContext>>(this.routeOptions)
    newBuilder.prepareSteps = [...this.prepareSteps]
    newBuilder.parseSteps = [...this.parseSteps]
    return newBuilder
  }

  // Single-parameter parse method - THE KEY INNOVATION that eliminates overload resolution issues
  parse<TPayload extends SingleParamParsePayload<TContext>>(
    payload: TPayload
  ): RouteBuilder<TContext & { parsed: (TContext extends { parsed: infer TExisting } ? TExisting : {}) & RemoveNever<ExtractSingleParamResults<TPayload>> }> {
    // Store the parse step for later execution
    this.parseSteps.push({
      payload,
      parseFn: async (req: Request, ctx: unknown) => {
        const parsedResults: Record<string, unknown> = {}
        const context = ctx as Record<string, unknown> & { 
          _bodyCache?: unknown, 
          _queryCache?: Record<string, string> 
        }

        const predefinedFields = ['headers', 'body', 'query', 'cookies', 'auth', 'method', 'path']

        for (const [key, value] of Object.entries(payload)) {
          if (typeof value === 'function' && predefinedFields.includes(key)) {
            try {
              let enhancedContext: Record<string, unknown>

              if (key === 'body') {
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
              } else if (key === 'query') {
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
              } else if (key === 'auth') {
                // Parse auth header
                const authHeader = req.headers.get('authorization')
                if (!authHeader) {
                  throw new Error("Authorization header is required")
                }
                enhancedContext = { ...(ctx as Record<string, unknown>), authHeader }
              } else if (key === 'headers') {
                enhancedContext = { ...(ctx as Record<string, unknown>), headers: req.headers }
              } else if (key === 'cookies') {
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

    // Create new builder with simple parsed context
    const newBuilder = new RouteBuilder<TContext & { parsed: (TContext extends { parsed: infer TExisting } ? TExisting : {}) & RemoveNever<ExtractSingleParamResults<TPayload>> }>(this.routeOptions)
    newBuilder.prepareSteps = [...this.prepareSteps]
    newBuilder.parseSteps = [...this.parseSteps]
    
    return newBuilder
  }

  handle<TResponse>(
    handlerFn: (req: Request, ctx: TContext) => Promise<TResponse>
  ): EnhancedRouteHandler<TContext, TResponse> {
    const { onRequest, onResponse, onError, requestObject } = this.routeOptions
    const prepareSteps = this.prepareSteps
    const parseSteps = this.parseSteps

    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        let request: Request
        try {
          const requestMapper = requestObject || FrameworkAdapters.auto
          request = requestMapper(args.length === 1 ? args[0] : args)
        } catch (error) {
          throw new RouteError("Bad Request: Invalid request object", {
            errorCode: 'REQUEST_MAPPING_ERROR',
            errorMessage: `Failed to extract Request object: ${(error as Error).message}`,
            httpStatus: 400,
            cause: error as Error
          })
        }

        if (onRequest) {
          await onRequest(request)
        }

        // Build context by executing prepare steps
        let context: Record<string, unknown> = {}

        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(request, context)
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
            }
          } catch (error) {
            if (onError) {
              await onError(error as Error)
            }
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
        }

        // Execute parse steps with progressive type narrowing
        for (const parseStep of parseSteps) {
          try {
            const result = await parseStep.parseFn(request, context)
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              const parsedContext = context.parsed as Record<string, unknown>
              const newResults = result as Record<string, unknown>

              for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                // Merge results - if field already exists and both are objects, merge them
                if (parsedContext[fieldName] && typeof parsedContext[fieldName] === 'object' && 
                    fieldResult && typeof fieldResult === 'object') {
                  parsedContext[fieldName] = { ...(parsedContext[fieldName] as Record<string, unknown>), ...(fieldResult as Record<string, unknown>) }
                } else {
                  // For non-objects or first occurrence, just assign
                  parsedContext[fieldName] = fieldResult
                }
              }
              context.parsed = parsedContext
            }
          } catch (error) {
            if (onError) {
              await onError(error as Error)
            }
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

        const response = await handlerFn(request, context as TContext)

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
          await onResponse(responseForHook)
        }

        return response
      } catch (error) {
        if (onError) {
          await onError(error as Error)
        }
        throw error
      }
    }

    // Enhanced invoke method
    routeHandler.invoke = async (contextOverride?: Partial<TContext>): Promise<TResponse> => {
      try {
        const mockRequest = new Request('http://localhost/invoke')
        const isCompleteOverride = contextOverride && 'parsed' in contextOverride

        if (isCompleteOverride) {
          const fullContext = { ...contextOverride } as TContext
          return await handlerFn(mockRequest, fullContext)
        }

        let context: Record<string, unknown> = {}
        if (contextOverride) {
          context = { ...contextOverride }
        }

        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(mockRequest, context)
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
            }
          } catch (error) {
            if (onError) {
              await onError(error as Error)
            }
            if (error instanceof RouteError) {
              throw error
            }
            throw new Error((error as Error).message)
          }
        }

        for (const parseStep of parseSteps) {
          try {
            const result = await parseStep.parseFn(mockRequest, context)
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              const parsedContext = context.parsed as Record<string, unknown>
              const newResults = result as Record<string, unknown>

              for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                // Merge results - if field already exists and both are objects, merge them
                if (parsedContext[fieldName] && typeof parsedContext[fieldName] === 'object' && 
                    fieldResult && typeof fieldResult === 'object') {
                  parsedContext[fieldName] = { ...(parsedContext[fieldName] as Record<string, unknown>), ...(fieldResult as Record<string, unknown>) }
                } else {
                  // For non-objects or first occurrence, just assign
                  parsedContext[fieldName] = fieldResult
                }
              }
              context.parsed = parsedContext
            }
          } catch (error) {
            if (onError) {
              await onError(error as Error)
            }
            if (error instanceof RouteError) {
              throw error
            }
            throw new Error((error as Error).message)
          }
        }

        return await handlerFn(mockRequest, context as TContext)
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

    routeHandler.inferRouteType = {} as RouteTypeInfo<TContext, TResponse>
    return routeHandler as EnhancedRouteHandler<TContext, TResponse>
  }
}

// Enhanced route handler interface
interface EnhancedRouteHandler<TContext, TResponse> {
  (...args: unknown[]): Promise<TResponse>
  invoke(contextOverride?: Partial<TContext>): Promise<TResponse>
  inferRouteType: RouteTypeInfo<TContext, TResponse>
}

// Route type extraction interface (simplified)
type RouteTypeInfo<TContext, TResponse> = {
  path: string
  method: string
  input: {
    body: unknown
    query: unknown
  }
  returnValue: TResponse
} 
