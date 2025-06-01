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

// Base context type - will be extended by builder
type EmptyContext = Record<string, never>

// HTTP methods supported
type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

export const createRoute = (routeOptions: RouteOptions = {}) => {
  return new RouteBuilder(routeOptions)
}

export class RouteBuilder<TContext = EmptyContext> {
  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = routeOptions
  }

  prepare<TNewContext extends Record<string, unknown>>(
    prepareFunction: (req: Request, ctx: TContext) => Promise<TNewContext | undefined>
  ): RouteBuilder<TContext & TNewContext> {
    // TODO: implement in Stage 4
    throw new Error("Not implemented yet")
  }

  parse<TParsed extends Record<string, unknown>>(payload: {
    headers?: (headers: Headers, ctx: TContext) => Promise<unknown>
    body?: (body: unknown, ctx: TContext) => Promise<unknown>
    query?: (query: unknown, ctx: TContext) => Promise<unknown>
    cookies?: (cookies: unknown, ctx: TContext) => Promise<unknown>
    auth?: (authorizationHeader: string, ctx: TContext) => Promise<unknown>
    method?: RouteMethod | RouteMethod[]
    path?: string
  } & Record<string, (req: Request, ctx: TContext) => Promise<unknown>>): RouteBuilder<TContext & { parsed: TParsed }> {
    // TODO: implement in Stage 5
    throw new Error("Not implemented yet")
  }

  handle<TResponse>(
    handlerFn: (req: Request, ctx: TContext) => Promise<TResponse>
  ): RouteHandler<TContext, TResponse> {
    // TODO: build ctx properly in later stages
    const ctx = {} as TContext

    async function routeHandler(req: Request): Promise<TResponse> {
      return handlerFn(req, ctx)
    }
    
    routeHandler.invoke = async (contextOverride?: TContext): Promise<TResponse> => {
      // For now, create a mock request for invoke
      const mockRequest = new Request('http://localhost')
      const finalContext = contextOverride || ctx
      return handlerFn(mockRequest, finalContext)
    }

    return routeHandler as RouteHandler<TContext, TResponse>
  }
}

interface RouteHandler<TContext, TResponse> {
  (req: Request): Promise<TResponse>
  invoke(contextOverride?: TContext): Promise<TResponse>
}
