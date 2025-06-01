import { describe, test, expect } from "bun:test"
import { createRoute, RouteError } from "./createRoute"

describe("Stage 1: Foundation Types & RouteError", () => {
  describe("RouteError", () => {
    test("create RouteError with all properties", () => {
      const originalError = new Error("Original error")
      const routeError = new RouteError("Bad Request: Error parsing `body`", {
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Invalid JSON format',
        httpStatus: 400,
        cause: originalError
      })

      expect(routeError.name).toBe('RouteError')
      expect(routeError.message).toBe("Bad Request: Error parsing `body`")
      expect(routeError.errorCode).toBe('PARSE_ERROR')
      expect(routeError.errorMessage).toBe('Invalid JSON format')
      expect(routeError.httpStatus).toBe(400)
      expect(routeError.cause).toBe(originalError)
      expect(routeError instanceof Error).toBe(true)
    })

    test("create RouteError without cause", () => {
      const routeError = new RouteError("Unauthorized", {
        errorCode: 'PREPARE_ERROR',
        errorMessage: 'Access denied',
        httpStatus: 401
      })

      expect(routeError.cause).toBeUndefined()
      expect(routeError.httpStatus).toBe(401)
    })
  })

  describe("createRoute", () => {
    test("create route with no options", () => {
      const routeBuilder = createRoute()
      expect(routeBuilder).toBeDefined()
      expect(typeof routeBuilder.handle).toBe('function')
    })

    test("create route with empty options", () => {
      const routeBuilder = createRoute({})
      expect(routeBuilder).toBeDefined()
    })

    test("create route with all options", () => {
      const routeBuilder = createRoute({
        onRequest: async (req) => {
          console.log("request received:", req.method)
        },
        onResponse: async (res) => {
          console.log("response sent:", res.status)
        },
        onError: async (err) => {
          console.error(err)
        },
        requestObject: (args) => args as Request
      })
      expect(routeBuilder).toBeDefined()
    })
  })

  describe("RouteBuilder", () => {
    test("handle simple route with empty context", async () => {
      const POST = createRoute().handle(async (req, ctx) => {
        // ctx should be empty object type
        return { ok: true }
      })

      expect(typeof POST).toBe('function')
      expect(typeof POST.invoke).toBe('function')

      // Test invoke method
      const result = await POST.invoke()
      expect(result).toEqual({ ok: true })
    })

    test("handle route with custom response type", async () => {
      const GET = createRoute().handle(async (req, ctx) => {
        return { 
          users: [{ id: 1, name: "John" }],
          total: 1 
        }
      })

      const result = await GET.invoke()
      expect(result).toEqual({
        users: [{ id: 1, name: "John" }],
        total: 1
      })
    })

    test("throw error for prepare method (not implemented yet)", () => {
      expect(() => {
        createRoute().prepare(async (req, ctx) => {
          return { role: "admin" }
        })
      }).toThrow("Not implemented yet")
    })

    test("throw error for parse method (not implemented yet)", () => {
      expect(() => {
        createRoute().parse({
          body: async (body, ctx) => ({ name: "test" })
        })
      }).toThrow("Not implemented yet")
    })
  })

  describe("Type Safety", () => {
    test("maintain type safety in handle function", async () => {
      // This test verifies TypeScript compilation
      const route = createRoute().handle(async (req, ctx) => {
        // ctx is properly typed as empty object
        expect(ctx).toEqual({})
        return { success: true, timestamp: Date.now() }
      })

      const result = await route.invoke({})
      expect(result.success).toBe(true)
      expect(typeof result.timestamp).toBe('number')
    })
  })
})

describe("Stage 2: Basic Builder Pattern", () => {
  describe("RouteBuilder Constructor", () => {
    test("store route options with defaults", () => {
      const routeBuilder = createRoute({
        onRequest: async (req) => {
          console.log("request:", req.url)
        }
      })
      expect(routeBuilder).toBeDefined()
    })

    test("apply default requestObject mapper", () => {
      const routeBuilder = createRoute()
      expect(routeBuilder).toBeDefined()
    })
  })

  describe("Route Handler with Lifecycle Hooks", () => {
    test("call onRequest hook before handler", async () => {
      let requestCalled = false
      
      const route = createRoute({
        onRequest: async (req) => {
          requestCalled = true
          expect(req instanceof Request).toBe(true)
        }
      }).handle(async (req, ctx) => {
        expect(requestCalled).toBe(true)
        return { success: true }
      })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
      expect(requestCalled).toBe(true)
    })

    test("call onResponse hook after handler", async () => {
      let responseCalled = false
      
      const route = createRoute({
        onResponse: async (res) => {
          responseCalled = true
          expect(res instanceof Response).toBe(true)
          expect(res.status).toBe(200)
        }
      }).handle(async (req, ctx) => {
        return { message: "hello" }
      })

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)
      expect(responseCalled).toBe(true)
    })

    test("call onError hook when handler throws", async () => {
      let errorCalled = false
      const testError = new Error("Test error")
      
      const route = createRoute({
        onError: async (err) => {
          errorCalled = true
          expect(err).toBe(testError)
        }
      }).handle(async (req, ctx) => {
        throw testError
      })

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
      } catch (error) {
        expect(error).toBe(testError)
      }
      
      expect(errorCalled).toBe(true)
    })
  })

  describe("Request Object Mapping", () => {
    test("use default request object mapper", async () => {
      const route = createRoute().handle(async (req, ctx) => {
        expect(req instanceof Request).toBe(true)
        return { url: req.url }
      })

      const mockRequest = new Request('http://localhost/api/test')
      const result = await route(mockRequest)
      expect(result.url).toBe('http://localhost/api/test')
    })

    test("use custom request object mapper", async () => {
      const route = createRoute({
        requestObject: (args) => {
          // Simulate framework that passes request in a wrapper
          const wrapper = args as { req: Request }
          return wrapper.req
        }
      }).handle(async (req, ctx) => {
        expect(req instanceof Request).toBe(true)
        return { method: req.method }
      })

      const mockRequest = new Request('http://localhost/test', { method: 'POST' })
      const wrapper = { req: mockRequest }
      // Cast to function that accepts unknown args
      const routeHandler = route as (...args: unknown[]) => Promise<{ method: string }>
      const result = await routeHandler(wrapper)
      expect(result.method).toBe('POST')
    })
  })

  describe("Invoke Method Enhanced", () => {
    test("invoke without context override", async () => {
      const route = createRoute().handle(async (req, ctx) => {
        return { timestamp: Date.now(), ctx: ctx }
      })

      const result = await route.invoke()
      expect(typeof result.timestamp).toBe('number')
      expect(result.ctx).toEqual({})
    })

    test("invoke with context override", async () => {
      const route = createRoute().handle(async (req, ctx) => {
        return { ctx }
      })

      // Use empty object for context override since TContext is EmptyContext
      const result = await route.invoke({})
      expect(result.ctx).toEqual({})
    })

    test("invoke wraps non-RouteError errors", async () => {
      const route = createRoute().handle(async (req, ctx) => {
        throw new Error("Something went wrong")
      })

      try {
        await route.invoke()
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('HANDLER_ERROR')
        expect(routeError.httpStatus).toBe(500)
        expect(routeError.errorMessage).toBe("Something went wrong")
        expect(routeError.cause?.message).toBe("Something went wrong")
      }
    })

    test("invoke preserves RouteError", async () => {
      const customRouteError = new RouteError("Custom error", {
        errorCode: 'CUSTOM_ERROR',
        errorMessage: 'Custom message',
        httpStatus: 422
      })

      const route = createRoute().handle(async (req, ctx) => {
        throw customRouteError
      })

      try {
        await route.invoke()
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBe(customRouteError)
      }
    })

    test("invoke skips lifecycle hooks", async () => {
      let hooksCalled = 0

      const route = createRoute({
        onRequest: async () => { hooksCalled++ },
        onResponse: async () => { hooksCalled++ },
        onError: async () => { hooksCalled++ }
      }).handle(async (req, ctx) => {
        return { success: true }
      })

      await route.invoke()
      expect(hooksCalled).toBe(0) // No hooks should be called for invoke
    })
  })
})
