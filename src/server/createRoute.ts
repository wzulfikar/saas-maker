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

    // Main route handler function
    async function routeHandler(...args: unknown[]): Promise<TResponse> {
      try {
        // Extract request object using the requestObject mapper
        const request = requestObject ? requestObject(args.length === 1 ? args[0] : args) : (args[0] as Request)
        
        // Call onRequest hook if provided
        if (onRequest) {
          await onRequest(request)
        }

        // For now, use empty context (will be built properly in later stages)
        const context = {} as TContext

        // Call the actual handler
        const response = await handlerFn(request, context)

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
        
        // Use provided context or empty context
        const context = contextOverride || ({} as TContext)
        
        // Call handler directly (skip onRequest/onResponse hooks for invoke)
        return await handlerFn(mockRequest, context)
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
