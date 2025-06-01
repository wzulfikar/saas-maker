export const createRoute = async (routeOptions: RouteOptions) => {
  return new RouteBuilder(routeOptions)
}

type RouteOptions = {
  onRequest: (req: Request) => Promise<void>
  onResponse: (res: Response) => Promise<void>
  onError: (err: Error) => Promise<void>
  requestObject?: (args: unknown) => Request
}

type RouteContext = any // TODO: implement

type RouteMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD"

export class RouteBuilder {
  constructor(private routeOptions: RouteOptions) {
    this.routeOptions = routeOptions
  }

  prepare(req: Request, ctx: RouteContext) {
    // TODO: implement. should return req, ctx again
  }

  parse(payload: {
    headers: (headers: Headers) => Promise<unknown>
    body: (body: unknown) => Promise<unknown>
    query: (query: unknown) => Promise<unknown>
    cookies: (cookies: unknown) => Promise<unknown>
    auth: (authorizationHeader: string) => Promise<unknown>
    method: RouteMethod | RouteMethod[]
    path: string
  }) {
    // TODO: implement
  }

  handle(handlerFn: (req: Request, ctx: RouteContext) => Promise<any>): RouteHandler {
    // TODO: build ctx
    const ctx = {}

    async function routeHandler(req: Request) {
      return handlerFn(req, ctx)
    }
    routeHandler.invoke = async () => {
      // TODO: call handlerFn
    }

    return routeHandler
  }
}

interface RouteHandler {
  (req: Request): Promise<any>
  invoke(): Promise<any>
}
