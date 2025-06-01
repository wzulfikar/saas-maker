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

// Route options - all optional with sensible defaults
type RouteOptions = {
  onRequest?: (req: Request) => Promise<void>
  onResponse?: (res: Response) => Promise<void>
  onError?: (err: Error) => Promise<void>
  requestObject?: (args: unknown) => Request
}

// Context types for progressive building
type EmptyContext = Record<string, never>

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
      requestObject: (args) => args as Request,
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

  parse<TParsed extends Record<string, unknown>>(payload: {
    headers?: (headers: Headers, ctx: TContext) => Promise<unknown>
    body?: (body: unknown, ctx: TContext) => Promise<unknown>
    query?: (query: unknown, ctx: TContext) => Promise<unknown>
    cookies?: (cookies: unknown, ctx: TContext) => Promise<unknown>
    auth?: (authorizationHeader: string, ctx: TContext) => Promise<unknown>
    method?: RouteMethod | RouteMethod[]
    path?: string
  } | Record<string, (req: Request, ctx: TContext) => Promise<unknown>>): RouteBuilder<
    TContext extends { parsed: infer TExistingParsed }
      ? MergeContexts<ExtractNonParsed<TContext>, WithParsed<Record<string, never>, MergeParsed<TExistingParsed, TParsed>>>
      : WithParsed<TContext, TParsed>
  > {
    // Store the parse step for later execution
    this.parseSteps.push({
      payload,
      parseFn: () => Promise.resolve({}) // TODO: implement actual parsing in Stage 5
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
  ): RouteHandler<TContext, TResponse> {
    const { onRequest, onResponse, onError, requestObject } = this.routeOptions
    const prepareSteps = this.prepareSteps
    const parseSteps = this.parseSteps

    // Main route handler function
    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        // Extract request object using the requestObject mapper
        const request = requestObject ? requestObject(args.length === 1 ? args[0] : args) : (args[0] as Request)
        
        // Call onRequest hook if provided
        if (onRequest) {
          await onRequest(request)
        }

        // Build context by executing prepare steps
        let context: Record<string, unknown> = {}
        
        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(request, context)
            // Merge returned context (if any) into existing context
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
            }
          } catch (error) {
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

        // Execute parse steps (placeholder for Stage 5)
        for (const parseStep of parseSteps) {
          try {
            // TODO: implement actual parsing in Stage 5
            const result = await parseStep.parseFn(request, context)
            // For now, just placeholder logic
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              // This is simplified - actual parsing will be more sophisticated
              Object.assign(context.parsed as Record<string, unknown>, result as Record<string, unknown>)
            }
          } catch (error) {
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

        // Call the actual handler with built context
        const response = await handlerFn(request, context as TContext)

        // Call onResponse hook if provided (need to create Response object)
        if (onResponse) {
          // Create a mock Response for the hook
          const mockResponse = new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
          await onResponse(mockResponse)
        }

        return response
      } catch (error) {
        // Handle errors through the error hook
        if (onError) {
          await onError(error as Error)
        }
        
        // Re-throw the error so it can be handled by the framework
        throw error
      }
    }
    
    // Add invoke method for server-side calls
    routeHandler.invoke = async (contextOverride?: TContext): Promise<TResponse> => {
      try {
        // Create a mock request for invoke
        const mockRequest = new Request('http://localhost/test')
        
        if (contextOverride) {
          // Use provided context directly (skip prepare/parse execution)
          return await handlerFn(mockRequest, contextOverride)
        }
        
        // Execute prepare steps to build context
        let context: Record<string, unknown> = {}
        
        for (const prepareStep of prepareSteps) {
          try {
            const result = await prepareStep(mockRequest, context)
            if (result && typeof result === 'object') {
              context = { ...context, ...result }
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

        // Execute parse steps (placeholder)
        for (const parseStep of parseSteps) {
          try {
            const result = await parseStep.parseFn(mockRequest, context)
            if (result && typeof result === 'object') {
              if (!context.parsed) {
                context.parsed = {}
              }
              Object.assign(context.parsed as Record<string, unknown>, result as Record<string, unknown>)
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
        }
        
        // Call handler with built context (skip onRequest/onResponse hooks for invoke)
        return await handlerFn(mockRequest, context as TContext)
      } catch (error) {
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

    return routeHandler as RouteHandler<TContext, TResponse>
  }
}

interface RouteHandler<TContext, TResponse> {
  (...args: unknown[]): Promise<TResponse>
  invoke(contextOverride?: TContext): Promise<TResponse>
}
