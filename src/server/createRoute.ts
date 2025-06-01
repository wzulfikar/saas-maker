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

// Framework-specific request object mappers (internal - for reference/examples)
const FrameworkAdapters = {
  // Next.js App Router: (request: NextRequest, context: NextContext) => Response
  nextjs: (args: unknown) => {
    const argsArray = Array.isArray(args) ? args : [args]
    return argsArray[0] as Request // NextRequest extends Request
  },

  // Express: (req: Request, res: Response, next: NextFunction) => void
  express: (args: unknown) => {
    const argsArray = Array.isArray(args) ? args : [args]
    const req = argsArray[0] as Record<string, unknown>
    
    // Convert Express request to standard Request
    if (req?.method && req.url) {
      const getFunc = req.get as ((header: string) => string | undefined) | undefined
      const url = req.protocol ? `${req.protocol}://${getFunc?.('host') ?? 'localhost'}${req.originalUrl || req.url}` 
                                : `http://localhost${req.originalUrl || req.url}`
      const headers = new Headers(req.headers as Record<string, string> || {})
      
      return new Request(url, {
        method: req.method as string,
        headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
      })
    }
    
    throw new Error('Invalid Express request object')
  },

  // Hono: (c: Context) => Response
  hono: (args: unknown) => {
    const context = args as Record<string, unknown>
    if (context?.req) {
      return context.req as Request
    }
    throw new Error('Invalid Hono context object')
  },

  // Cloudflare Workers: (request: Request, env: Env, ctx: ExecutionContext) => Response
  cloudflare: (args: unknown) => {
    const argsArray = Array.isArray(args) ? args : [args]
    return argsArray[0] as Request
  },

  // Bun: (request: Request) => Response
  bun: (args: unknown) => {
    return args as Request
  },

  // Generic: Extract Request from various patterns
  auto: (args: unknown) => {
    // If single argument and it's a Request, use it
    if (args && typeof args === 'object' && (args as Record<string, unknown>).method && (args as Record<string, unknown>).url) {
      return args as Request
    }
    
    // If array, try first element
    if (Array.isArray(args) && args[0]) {
      const first = args[0]
      if (first && typeof first === 'object' && (first as Record<string, unknown>).method && (first as Record<string, unknown>).url) {
        return first as Request
      }
    }
    
    // Default fallback
    return args as Request
  }
} as const

// Enhanced route options with minimal framework integration
type RouteOptions = {
  onRequest?: (req: Request, metadata: { timestamp: number, requestId: string }) => Promise<void>
  onResponse?: (res: Response, metadata: { timestamp: number, requestId: string, duration: number }) => Promise<void>
  onError?: (err: Error, metadata: { timestamp: number, requestId: string, stage: 'prepare' | 'parse' | 'handle' }) => Promise<void>
  requestObject?: (args: unknown) => Request
  // Stage 8 options - renamed onPrepareComplete to onPrepareCompleted
  onPrepareStart?: (req: Request) => Promise<void>
  onPrepareCompleted?: (req: Request, context: Record<string, unknown>) => Promise<void>
  onParseStart?: (req: Request, context: Record<string, unknown>) => Promise<void>
  onParseComplete?: (req: Request, context: Record<string, unknown>) => Promise<void>
  generateRequestId?: () => string
  // Stage 9 additions
  errorHandler?: (error: RouteError, metadata: { timestamp: number, requestId: string, stage: string }) => Promise<Response | undefined>
}

// Context types for progressive building
type EmptyContext = Record<string, never>

// Enhanced context with requestId
type ContextWithRequestId = { requestId: string }

// Type utility to merge contexts progressively
type MergeContexts<T, U> = T & U

// Type utility for parsed results
type WithParsed<TContext, TParsed> = TContext & { parsed: TParsed }

// Type utility to merge parsed results (for multiple parse calls)
type MergeParsed<TExisting, TNew> = {
  [K in keyof TExisting | keyof TNew]: K extends keyof TNew
    ? K extends keyof TExisting
      ? TExisting[K] & TNew[K] // Intersection for type narrowing
      : TNew[K]
    : K extends keyof TExisting
    ? TExisting[K]
    : never
}

// Helper type to extract parsed context
type ExtractParsed<T> = T extends { parsed: infer P } ? P : Record<string, never>

// Helper type to extract non-parsed context
type ExtractNonParsed<T> = Omit<T, 'parsed'>

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

// Enhanced createRoute with framework integration
export const createRoute = (routeOptions: RouteOptions = {}) => {
  return new RouteBuilder<ContextWithRequestId>(routeOptions)
}

export class RouteBuilder<TContext = ContextWithRequestId> {
  private prepareSteps: Array<(req: Request, ctx: unknown) => Promise<unknown>> = []
  private parseSteps: Array<{
    payload: unknown
    parseFn: (req: Request, ctx: unknown) => Promise<unknown>
  }> = []

  constructor(private routeOptions: RouteOptions) {
    // Enhanced request object mapping with framework support
    const getRequestMapper = (): (args: unknown) => Request => {
      // If framework is specified, use its adapter
      if (routeOptions.requestObject) {
        return routeOptions.requestObject
      }
      
      // Default to auto-detection
      return FrameworkAdapters.auto
    }

    this.routeOptions = {
      requestObject: getRequestMapper(),
      ...routeOptions
    }
  }

  prepare<TNewContext extends Record<string, unknown>>(
    prepareFunction: (req: Request, ctx: TContext) => Promise<TNewContext | undefined>
  ): RouteBuilder<MergeContexts<TContext, TNewContext>> {
    // Store the prepare step for later execution
    this.prepareSteps.push(prepareFunction as (req: Request, ctx: unknown) => Promise<unknown>)
    
    // Return new builder with merged context type
    const newBuilder = new RouteBuilder<MergeContexts<TContext, TNewContext>>(this.routeOptions)
    newBuilder.prepareSteps = [...this.prepareSteps]
    newBuilder.parseSteps = [...this.parseSteps]
    
    return newBuilder
  }

  parse<TParsed extends Record<string, unknown>>(
    payload: 
      | {
          headers?: (headers: Headers, ctx: TContext) => Promise<unknown>
          body?: (body: unknown, ctx: TContext) => Promise<unknown>
          query?: (query: Record<string, string>, ctx: TContext) => Promise<unknown>
          cookies?: (cookies: Record<string, string>, ctx: TContext) => Promise<unknown>
          auth?: (authorizationHeader: string, ctx: TContext) => Promise<unknown>
          method?: RouteMethod | RouteMethod[]
          path?: string
        }
      | Record<string, (req: Request, ctx: TContext) => Promise<unknown>>
  ): RouteBuilder<
    TContext extends { parsed: infer TExistingParsed }
      ? MergeContexts<ExtractNonParsed<TContext>, WithParsed<Record<string, never>, MergeParsed<TExistingParsed, TParsed>>>
      : WithParsed<TContext, TParsed>
  > {
    // Store the parse step for later execution
    this.parseSteps.push({
      payload,
      parseFn: async (req: Request, ctx: unknown) => {
        const parsedResults: Record<string, unknown> = {}
        
        // Check if this is a predefined fields object or custom fields object
        const predefinedFields = ['headers', 'body', 'query', 'cookies', 'auth', 'method', 'path']
        const hasAnyPredefinedField = Object.keys(payload).some(key => predefinedFields.includes(key))
        
        if (hasAnyPredefinedField) {
          // Handle predefined fields with their specific parameter types
          const predefinedPayload = payload as {
            headers?: (headers: Headers, ctx: TContext) => Promise<unknown>
            body?: (body: unknown, ctx: TContext) => Promise<unknown>
            query?: (query: Record<string, string>, ctx: TContext) => Promise<unknown>
            cookies?: (cookies: Record<string, string>, ctx: TContext) => Promise<unknown>
            auth?: (authorizationHeader: string, ctx: TContext) => Promise<unknown>
            method?: RouteMethod | RouteMethod[]
            path?: string
          }
          
          // Handle predefined fields
          if (predefinedPayload.headers) {
            try {
              const result = await predefinedPayload.headers(req.headers, ctx as TContext)
              parsedResults.headers = result
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `headers`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.body) {
            try {
              // Parse request body
              const bodyText = await req.text()
              let bodyData: unknown
              try {
                bodyData = JSON.parse(bodyText)
              } catch {
                bodyData = bodyText // Fallback to text if not JSON
              }
              const result = await predefinedPayload.body(bodyData, ctx as TContext)
              parsedResults.body = result
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `body`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.query) {
            try {
              // Parse URL query parameters
              const url = new URL(req.url)
              const queryParams = Object.fromEntries(url.searchParams.entries())
              const result = await predefinedPayload.query(queryParams, ctx as TContext)
              parsedResults.query = result
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `query`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.cookies) {
            try {
              // Parse cookies from header with enhanced error handling
              const cookieHeader = req.headers.get('cookie') || ''
              const cookies = Object.fromEntries(
                cookieHeader.split(';')
                  .map(c => c.trim().split('='))
                  .filter(([key, value]) => key && value !== undefined && key.length > 0)
                  .map(([key, value]) => [key, value || ''])
              )
              const result = await predefinedPayload.cookies(cookies, ctx as TContext)
              parsedResults.cookies = result
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `cookies`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.auth) {
            try {
              // Parse Authorization header
              const authHeader = req.headers.get('authorization')
              if (!authHeader) {
                throw new Error("Authorization header is required")
              }
              const result = await predefinedPayload.auth(authHeader, ctx as TContext)
              parsedResults.auth = result
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `auth`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 400,
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.method) {
            try {
              // Validate HTTP method
              const method = req.method as RouteMethod
              const allowedMethods = Array.isArray(predefinedPayload.method) ? predefinedPayload.method : [predefinedPayload.method]
              if (!allowedMethods.includes(method)) {
                throw new Error(`Method ${method} not allowed. Expected: ${allowedMethods.join(', ')}`)
              }
              parsedResults.method = method
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `method`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 405, // Method Not Allowed
                cause: error as Error
              })
            }
          }

          if (predefinedPayload.path) {
            try {
              // Validate and parse path
              const url = new URL(req.url)
              const requestPath = url.pathname
              const expectedPath = predefinedPayload.path
              
              // Simple path matching for now (will be enhanced in Stage 10)
              if (requestPath !== expectedPath) {
                throw new Error(`Path ${requestPath} does not match expected path ${expectedPath}`)
              }
              parsedResults.path = { matched: expectedPath, params: {} }
            } catch (error) {
              throw new RouteError("Bad Request: Error parsing `path`", {
                errorCode: 'PARSE_ERROR',
                errorMessage: (error as Error).message,
                httpStatus: 404, // Not Found
                cause: error as Error
              })
            }
          }
          
          // Also handle any custom fields that might be mixed in
          for (const [key, value] of Object.entries(payload)) {
            if (!predefinedFields.includes(key) && typeof value === 'function') {
              try {
                const result = await (value as (req: Request, ctx: TContext) => Promise<unknown>)(req, ctx as TContext)
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
        } else {
          // Handle pure custom fields (Record<string, function>)
          const customPayload = payload as Record<string, (req: Request, ctx: TContext) => Promise<unknown>>
          
          for (const [key, value] of Object.entries(customPayload)) {
            if (typeof value === 'function') {
              try {
                const result = await value(req, ctx as TContext)
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
        }

        return parsedResults
      }
    })

    // Create new builder with updated context type
    type NewContextType = TContext extends { parsed: infer TExistingParsed }
      ? MergeContexts<ExtractNonParsed<TContext>, WithParsed<Record<string, never>, MergeParsed<TExistingParsed, TParsed>>>
      : WithParsed<TContext, TParsed>

    const newBuilder = new RouteBuilder<NewContextType>(this.routeOptions)
    newBuilder.prepareSteps = [...this.prepareSteps]
    newBuilder.parseSteps = [...this.parseSteps]
    
    return newBuilder
  }

  handle<TResponse>(
    handlerFn: (req: Request, ctx: TContext) => Promise<TResponse>
  ): EnhancedRouteHandler<TContext, TResponse> {
    const { onRequest, onResponse, onError, requestObject, onPrepareStart, onPrepareCompleted, onParseStart, onParseComplete, generateRequestId, errorHandler } = this.routeOptions
    const prepareSteps = this.prepareSteps
    const parseSteps = this.parseSteps

    // Enhanced route handler with framework integration
    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        // Enhanced metadata tracking for Stage 9
        const startTime = Date.now()
        const requestId = generateRequestId?.() || `req-${Math.random().toString(36).substring(2)}`
        
        // Enhanced request object extraction with framework support
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
        
        // Call onRequest hook if provided
        if (onRequest) {
          await onRequest(request, { timestamp: startTime, requestId })
        }

        // Call onPrepareStart hook
        if (onPrepareStart) {
          await onPrepareStart(request)
        }

        // Build context by executing prepare steps
        // Start with requestId in context
        let context: Record<string, unknown> = { requestId }
        
        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(request, context)
            // Merge returned context (if any) into existing context
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
            }
          } catch (error) {
            // Enhanced error handling with metadata
            if (onError) {
              await onError(error as Error, { timestamp: Date.now(), requestId, stage: 'prepare' })
            }
            
            // Wrap prepare errors in RouteError
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

        // Call onPrepareCompleted hook (renamed from onPrepareComplete)
        if (onPrepareCompleted) {
          await onPrepareCompleted(request, context)
        }

        // Call onParseStart hook
        if (onParseStart) {
          await onParseStart(request, context)
        }

        // Execute parse steps with progressive type narrowing
        for (const parseStep of parseSteps) {
          try {
            const result = await parseStep.parseFn(request, context)
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              
              // Enhanced merging for type narrowing
              const parsedContext = context.parsed as Record<string, unknown>
              const newResults = result as Record<string, unknown>
              
              for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                if (parsedContext[fieldName] && typeof parsedContext[fieldName] === 'object' && typeof fieldResult === 'object') {
                  // Merge objects for type narrowing (intersection)
                  parsedContext[fieldName] = {
                    ...parsedContext[fieldName] as Record<string, unknown>,
                    ...fieldResult as Record<string, unknown>
                  }
                } else {
                  // Override with new value (last wins for non-objects)
                  parsedContext[fieldName] = fieldResult
                }
              }
            }
          } catch (error) {
            // Enhanced error handling with metadata
            if (onError) {
              await onError(error as Error, { timestamp: Date.now(), requestId, stage: 'parse' })
            }
            
            // Wrap parse errors in RouteError
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

        // Call onParseComplete hook
        if (onParseComplete) {
          await onParseComplete(request, context)
        }

        // Call the actual handler with built context
        const response = await handlerFn(request, context as TContext)

        // Enhanced response handling for Stage 9
        const endTime = Date.now()
        const duration = endTime - startTime

        // Call onResponse hook if provided (need to create Response object)
        if (onResponse) {
          // Create a mock Response for the hook with metadata
          const mockResponse = new Response(JSON.stringify(response), {
            status: 200,
            headers: { 
              'Content-Type': 'application/json',
              'X-Request-ID': requestId,
              'X-Duration': duration.toString()
            }
          })
          await onResponse(mockResponse, { timestamp: endTime, requestId, duration })
        }

        return response
      } catch (error) {
        // Enhanced error handling with framework integration
        const errorTime = Date.now()
        const requestId = generateRequestId?.() || `req-${Math.random().toString(36).substring(2)}`
        
        // Handle errors through the error hook
        if (onError) {
          await onError(error as Error, { timestamp: errorTime, requestId, stage: 'handle' })
        }

        // Framework-specific error handling
        if (errorHandler && error instanceof RouteError) {
          const errorResponse = await errorHandler(error, { timestamp: errorTime, requestId, stage: 'handle' })
          if (errorResponse) {
            return errorResponse as TResponse
          }
        }
        
        // Re-throw the error so it can be handled by the framework
        throw error
      }
    }
    
    // Enhanced invoke method with better context typing
    routeHandler.invoke = async (contextOverride?: Partial<TContext>): Promise<TResponse> => {
      try {
        // Enhanced metadata tracking for Stage 9
        const startTime = Date.now()
        const requestId = generateRequestId?.() || `req-${Math.random().toString(36).substring(2)}`
        
        // Create a mock request for invoke
        const mockRequest = new Request('http://localhost/invoke')
        
        if (contextOverride) {
          // Merge provided context with requestId
          const fullContext = { requestId, ...contextOverride } as TContext
          return await handlerFn(mockRequest, fullContext)
        }
        
        // Call onPrepareStart hook for invoke
        if (onPrepareStart) {
          await onPrepareStart(mockRequest)
        }
        
        // Execute prepare steps to build context
        // Start with requestId in context
        let context: Record<string, unknown> = { requestId }
        
        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(mockRequest, context)
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
            }
          } catch (error) {
            // Enhanced error handling with metadata for invoke
            if (onError) {
              await onError(error as Error, { timestamp: Date.now(), requestId, stage: 'prepare' })
            }
            
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

        // Call onPrepareCompleted hook for invoke (renamed)
        if (onPrepareCompleted) {
          await onPrepareCompleted(mockRequest, context)
        }

        // Call onParseStart hook for invoke
        if (onParseStart) {
          await onParseStart(mockRequest, context)
        }

        // Execute parse steps with progressive type narrowing
        for (const parseStep of parseSteps) {
          try {
            const result = await parseStep.parseFn(mockRequest, context)
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              
              // Enhanced merging for type narrowing
              const parsedContext = context.parsed as Record<string, unknown>
              const newResults = result as Record<string, unknown>
              
              for (const [fieldName, fieldResult] of Object.entries(newResults)) {
                if (parsedContext[fieldName] && typeof parsedContext[fieldName] === 'object' && typeof fieldResult === 'object') {
                  // Merge objects for type narrowing (intersection)
                  parsedContext[fieldName] = {
                    ...parsedContext[fieldName] as Record<string, unknown>,
                    ...fieldResult as Record<string, unknown>
                  }
                } else {
                  // Override with new value (last wins for non-objects)
                  parsedContext[fieldName] = fieldResult
                }
              }
            }
          } catch (error) {
            // Enhanced error handling with metadata for invoke
            if (onError) {
              await onError(error as Error, { timestamp: Date.now(), requestId, stage: 'parse' })
            }
            
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
        }

        // Call onParseComplete hook for invoke
        if (onParseComplete) {
          await onParseComplete(mockRequest, context)
        }
        
        // Call handler with built context (note: onRequest/onResponse hooks are skipped for invoke)
        return await handlerFn(mockRequest, context as TContext)
      } catch (error) {
        // Enhanced error handling with metadata for invoke
        const errorTime = Date.now()
        const requestId = generateRequestId?.() || `req-${Math.random().toString(36).substring(2)}`
        
        // Handle errors through the error hook for invoke
        if (onError) {
          await onError(error as Error, { timestamp: errorTime, requestId, stage: 'handle' })
        }
        
        // Wrap non-RouteError errors
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

    // Add framework-specific response helpers
    routeHandler.asResponse = (status = 200, headers?: Record<string, string>) => {
      return async (...args: unknown[]): Promise<Response> => {
        try {
          const result = await routeHandler(...args)
          return new Response(JSON.stringify(result), {
            status,
            headers: {
              'Content-Type': 'application/json',
              ...headers
            }
          })
        } catch (error) {
          if (error instanceof RouteError) {
            return new Response(JSON.stringify({
              error: error.errorCode,
              message: error.errorMessage
            }), {
              status: error.httpStatus,
              headers: { 'Content-Type': 'application/json' }
            })
          }
          
          return new Response(JSON.stringify({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'An unexpected error occurred'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }

    return routeHandler as EnhancedRouteHandler<TContext, TResponse>
  }
}

// Enhanced route handler interface with framework integration
interface EnhancedRouteHandler<TContext, TResponse> {
  (...args: unknown[]): Promise<TResponse>
  invoke(contextOverride?: Partial<TContext>): Promise<TResponse>
  asResponse(status?: number, headers?: Record<string, string>): (...args: unknown[]) => Promise<Response>
}
