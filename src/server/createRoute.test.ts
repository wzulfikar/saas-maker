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
      const builder = createRoute().prepare(async (req, ctx) => {
        return { role: "admin" }
      })
      expect(builder).toBeDefined()
    })

    test("throw error for parse method (not implemented yet)", () => {
      const builder = createRoute().parse({
        body: async (body, ctx) => ({ name: "test" })
      })
      expect(builder).toBeDefined()
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

describe("Stage 3: Context Type System", () => {
  describe("Progressive Context Building", () => {
    test("empty context starts with EmptyContext type", () => {
      const builder = createRoute()
      expect(builder).toBeDefined()
      
      // This test mainly validates TypeScript compilation
      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as EmptyContext (Record<string, never>)
        // TypeScript should enforce this at compile time
        const keys = Object.keys(ctx)
        expect(keys).toEqual([])
        return { contextType: 'empty' }
      })
      
      expect(route).toBeDefined()
    })

    test("prepare method returns new builder with merged context type", () => {
      const builder = createRoute()
        .prepare(async (req, ctx) => {
          // ctx is EmptyContext here
          expect(Object.keys(ctx)).toEqual([])
          return { role: "admin" as const }
        })

      expect(builder).toBeDefined()
      
      // The builder should now have the context type extended
      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as { role: "admin" }
        // This validates TypeScript inference
        return { hasRole: 'role' in ctx }
      })
      
      expect(route).toBeDefined()
    })

    test("multiple prepare calls merge context types", () => {
      const builder = createRoute()
        .prepare(async (req, ctx) => {
          return { role: "admin" as const }
        })
        .prepare(async (req, ctx) => {
          // ctx should now have { role: "admin" }
          return { userId: "123" }
        })

      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as { role: "admin" } & { userId: string }
        return { 
          hasRole: 'role' in ctx,
          hasUserId: 'userId' in ctx 
        }
      })
      
      expect(route).toBeDefined()
    })

    test("parse method adds parsed property to context", () => {
      const builder = createRoute()
        .parse({
          body: async (body: unknown, ctx: unknown) => {
            return { name: "test" }
          }
        })

      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as { parsed: { body: { name: string } } }
        return { 
          hasParsed: 'parsed' in ctx
        }
      })
      
      expect(route).toBeDefined()
    })

    test("multiple parse calls merge parsed results", () => {
      const builder = createRoute()
        .parse({
          headers: async (headers: Headers, ctx: unknown) => {
            return { userAgent: "test-agent" }
          }
        })
        .parse({
          body: async (body: unknown, ctx: unknown) => {
            return { name: "test" }
          }
        })

      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as { parsed: { headers: { userAgent: string }, body: { name: string } } }
        return { 
          hasParsed: 'parsed' in ctx
        }
      })
      
      expect(route).toBeDefined()
    })

    test("prepare and parse can be interleaved", () => {
      const builder = createRoute()
        .prepare(async (req, ctx) => {
          return { role: "admin" as const }
        })
        .parse({
          headers: async (headers: Headers, ctx: unknown) => {
            // ctx should have { role: "admin" }
            return { userAgent: "test" }
          }
        })
        .prepare(async (req, ctx) => {
          // ctx should have { role: "admin", parsed: { headers: { userAgent: string } } }
          return { timestamp: Date.now() }
        })

      const route = builder.handle(async (req, ctx) => {
        // ctx should be typed as { role: "admin", timestamp: number, parsed: { headers: { userAgent: string } } }
        return { 
          hasRole: 'role' in ctx,
          hasParsed: 'parsed' in ctx,
          hasTimestamp: 'timestamp' in ctx
        }
      })
      
      expect(route).toBeDefined()
    })
  })

  describe("Type Narrowing with Multiple Parse", () => {
    test("multiple parse calls on same field should merge types", () => {
      const builder = createRoute()
        .parse({
          body: async (body: unknown, ctx: unknown) => {
            // First validation - basic structure
            return { name: "test" as string }
          }
        })
        .parse({
          body: async (body: unknown, ctx: unknown) => {
            // Second validation - type narrowing (e.g., email validation)
            return { name: "test@example.com" as string, age: 25 }
          }
        })

      const route = builder.handle(async (req, ctx) => {
        // ctx.parsed.body should be intersection of both validations
        // { name: string } & { name: string, age: number } = { name: string, age: number }
        return { 
          hasParsed: 'parsed' in ctx
        }
      })
      
      expect(route).toBeDefined()
    })
  })

  describe("Builder Immutability", () => {
    test("prepare returns new builder instance", () => {
      const builder1 = createRoute()
      const builder2 = builder1.prepare(async (req, ctx) => {
        return { role: "admin" }
      })
      expect(builder1).not.toBe(builder2)
      expect(builder1).toBeDefined()
      expect(builder2).toBeDefined()
    })

    test("parse returns new builder instance", () => {
      const builder1 = createRoute()
      const builder2 = builder1.parse({
        body: async (body: unknown, ctx: unknown) => ({ name: "test" })
      })
      
      expect(builder1).not.toBe(builder2)
      expect(builder1).toBeDefined()
      expect(builder2).toBeDefined()
    })

    test("prepare and parse steps are copied to new builder", () => {
      const builder1 = createRoute()
        .prepare(async (req, ctx) => ({ step1: true }))
      
      const builder2 = builder1
        .prepare(async (req, ctx) => ({ step2: true }))
      
      const builder3 = builder2
        .parse({ 
          headers: async (headers: Headers, ctx: unknown) => ({ userAgent: "test" }) 
        })
      
      // Each builder should maintain the chain of steps
      expect(builder1).toBeDefined()
      expect(builder2).toBeDefined() 
      expect(builder3).toBeDefined()
    })
  })

  describe("Context Override Type Safety", () => {
    test("invoke method accepts properly typed context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => ({ role: "admin" as const }))
        .parse({
          headers: async (headers: Headers, ctx: unknown) => ({ userAgent: "test" })
        })
        .handle(async (req, ctx) => {
          return { 
            role: 'role' in ctx ? 'present' : 'missing',
            parsed: 'parsed' in ctx ? 'present' : 'missing'
          }
        })

      // TypeScript should enforce the context structure
      // Use type assertion for complex context type
      const contextOverride = {
        role: "admin" as const,
        parsed: {
          headers: { userAgent: "test" }
        }
      } as Record<string, unknown> // Type assertion needed for complex nested types

      const result = await route.invoke(contextOverride)
      
      expect(result).toEqual({
        role: 'present',
        parsed: 'present'
      })
    })
  })

  test("prepare method is implemented and working", () => {
    const builder = createRoute().prepare(async (req, ctx) => {
      return { role: "admin" }
    })
    
    expect(builder).toBeDefined()
    expect(typeof builder.handle).toBe('function')
  })

  test("parse method is implemented and working", () => {
    const builder = createRoute().parse({
      body: async (body, ctx) => ({ name: "test" })
    })
    
    expect(builder).toBeDefined()
    expect(typeof builder.handle).toBe('function')
  })
})

describe("Stage 4: Prepare Method", () => {
  describe("Context Building", () => {
    test("execute single prepare step and build context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          expect(req instanceof Request).toBe(true)
          expect(ctx).toEqual({})
          return { role: "admin", userId: "123" }
        })
        .handle(async (req, ctx) => {
          // Context should be built from prepare step
          expect(ctx).toEqual({ role: "admin", userId: "123" })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("execute multiple prepare steps and merge context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          expect(ctx).toEqual({})
          return { role: "admin" }
        })
        .prepare(async (req, ctx) => {
          expect(ctx).toEqual({ role: "admin" })
          return { userId: "123", permissions: ["read", "write"] }
        })
        .prepare(async (req, ctx) => {
          expect(ctx).toEqual({ 
            role: "admin", 
            userId: "123", 
            permissions: ["read", "write"] 
          })
          return { timestamp: 1234567890 }
        })
        .handle(async (req, ctx) => {
          expect(ctx).toEqual({
            role: "admin",
            userId: "123",
            permissions: ["read", "write"],
            timestamp: 1234567890
          })
          return { contextBuilt: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ contextBuilt: true })
    })

    test("prepare step can return undefined without affecting context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { role: "admin" }
        })
        .prepare(async (req, ctx) => {
          // This prepare doesn't return anything
          return undefined
        })
        .prepare(async (req, ctx) => {
          return { userId: "123" }
        })
        .handle(async (req, ctx) => {
          expect(ctx).toEqual({ role: "admin", userId: "123" })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Error Handling", () => {
    test("wrap prepare step errors in RouteError", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          throw new Error("Unauthorized access")
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PREPARE_ERROR')
        expect(routeError.httpStatus).toBe(400)
        expect(routeError.errorMessage).toBe("Unauthorized access")
        expect(routeError.message).toBe("Bad Request: Error preparing request handler")
        expect(routeError.cause?.message).toBe("Unauthorized access")
      }
    })

    test("preserve RouteError thrown from prepare step", async () => {
      const customRouteError = new RouteError("Custom unauthorized", {
        errorCode: 'AUTH_ERROR',
        errorMessage: 'Invalid token',
        httpStatus: 401
      })

      const route = createRoute()
        .prepare(async (req, ctx) => {
          throw customRouteError
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBe(customRouteError)
      }
    })

    test("error in later prepare step stops execution", async () => {
      let step2Called = false
      let step3Called = false

      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { step1: true }
        })
        .prepare(async (req, ctx) => {
          step2Called = true
          throw new Error("Step 2 failed")
        })
        .prepare(async (req, ctx) => {
          step3Called = true
          return { step3: true }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
      }
      
      expect(step2Called).toBe(true)
      expect(step3Called).toBe(false) // Should not be called after error
    })
  })

  describe("Invoke Method Context Building", () => {
    test("invoke without context override executes prepare steps", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { role: "admin" }
        })
        .prepare(async (req, ctx) => {
          return { userId: "123" }
        })
        .handle(async (req, ctx) => {
          return { 
            role: ctx.role,
            userId: ctx.userId 
          }
        })

      const result = await route.invoke()
      expect(result).toEqual({ 
        role: "admin", 
        userId: "123" 
      })
    })

    test("invoke with context override skips prepare steps", async () => {
      let prepareCalled = false

      const route = createRoute()
        .prepare(async (req, ctx) => {
          prepareCalled = true
          return { role: "admin" }
        })
        .handle(async (req, ctx) => {
          return { ctx }
        })

      const customContext = { customField: "value" } as any
      const result = await route.invoke(customContext)
      
      expect(prepareCalled).toBe(false)
      expect(result.ctx).toEqual({ customField: "value" })
    })

    test("invoke wraps prepare errors differently for invoke", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          throw new Error("Prepare failed")
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      try {
        await route.invoke()
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PREPARE_ERROR')
        expect(routeError.httpStatus).toBe(500) // 500 for invoke, 400 for request
        expect(routeError.message).toBe("Internal Server Error: Error in prepare step")
      }
    })
  })

  describe("Integration with Lifecycle Hooks", () => {
    test("prepare steps execute after onRequest hook", async () => {
      const executionOrder: string[] = []

      const route = createRoute({
        onRequest: async (req) => {
          executionOrder.push('onRequest')
        }
      })
        .prepare(async (req, ctx) => {
          executionOrder.push('prepare')
          return { role: "admin" }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)
      
      expect(executionOrder).toEqual(['onRequest', 'prepare', 'handle'])
    })
  })
})

describe("Stage 5: Parse Method Foundation", () => {
  describe("Predefined Field Parsing", () => {
    test("parse headers field", async () => {
      const route = createRoute()
        .parse({
          headers: async (headers, ctx) => {
            const userAgent = headers.get('user-agent')
            return { userAgent }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.headers).toEqual({ userAgent: 'test-agent' })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'user-agent': 'test-agent' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse body field with JSON", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            const parsed = body as { name: string, age: number }
            if (!parsed.name) throw new Error("Name is required")
            return { name: parsed.name, age: parsed.age }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body).toEqual({ name: 'John', age: 30 })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'John', age: 30 }),
        headers: { 'content-type': 'application/json' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse query parameters", async () => {
      const route = createRoute()
        .parse({
          query: async (query, ctx) => {
            const params = query as Record<string, string>
            return { 
              search: params.search || '',
              page: parseInt(params.page || '1')
            }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.query).toEqual({ search: 'test', page: 2 })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test?search=test&page=2')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse cookies", async () => {
      const route = createRoute()
        .parse({
          cookies: async (cookies, ctx) => {
            const parsed = cookies as Record<string, string>
            return { 
              sessionId: parsed.sessionId,
              theme: parsed.theme || 'light'
            }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.cookies).toEqual({ sessionId: '123', theme: 'dark' })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'cookie': 'sessionId=123; theme=dark' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse auth header", async () => {
      const route = createRoute()
        .parse({
          auth: async (authHeader, ctx) => {
            const token = authHeader.replace('Bearer ', '')
            if (token === 'valid-token') {
              return { userId: '123', role: 'admin' }
            }
            throw new Error('Invalid token')
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.auth).toEqual({ userId: '123', role: 'admin' })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'authorization': 'Bearer valid-token' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse method validation", async () => {
      const route = createRoute()
        .parse({
          method: 'POST'
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.method).toBe('POST')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', { method: 'POST' })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse path validation", async () => {
      const route = createRoute()
        .parse({
          path: '/api/users'
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.path).toEqual({ matched: '/api/users', params: {} })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/api/users')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Custom Field Parsing", () => {
    test("parse custom field", async () => {
      const route = createRoute()
        .parse({
          customField: async (req, ctx) => {
            const url = new URL(req.url)
            return { host: url.hostname }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.customField).toEqual({ host: 'localhost' })
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse multiple custom fields", async () => {
      const route = createRoute()
        .parse({
          timestamp: async (req, ctx) => {
            return { value: Date.now() }
          },
          requestId: async (req, ctx) => {
            return { id: Math.random().toString(36) }
          }
        })
        .handle(async (req, ctx) => {
          expect(typeof ctx.parsed.timestamp.value).toBe('number')
          expect(typeof ctx.parsed.requestId.id).toBe('string')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Mixed Parsing", () => {
    test("parse predefined and custom fields together", async () => {
      const route = createRoute()
        .parse({
          auth: async (authHeader, ctx) => {
            return { token: authHeader.replace('Bearer ', '') }
          },
          body: async (body, ctx) => {
            const parsed = body as { name: string }
            return { name: parsed.name }
          },
          customField: async (req, ctx) => {
            return { timestamp: Date.now() }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.auth.token).toBe('test-token')
          expect(ctx.parsed.body.name).toBe('test')
          expect(typeof ctx.parsed.customField.timestamp).toBe('number')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
        headers: { 
          'authorization': 'Bearer test-token',
          'content-type': 'application/json'
        }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Parse Error Handling", () => {
    test("wrap parse errors in RouteError", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            throw new Error("Invalid body format")
          }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: 'invalid json'
      })

      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PARSE_ERROR')
        expect(routeError.httpStatus).toBe(400)
        expect(routeError.message).toBe("Bad Request: Error parsing `body`")
        expect(routeError.errorMessage).toBe("Invalid body format")
      }
    })

    test("auth parsing requires authorization header", async () => {
      const route = createRoute()
        .parse({
          auth: async (authHeader, ctx) => {
            return { token: authHeader }
          }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')

      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PARSE_ERROR')
        expect(routeError.message).toBe("Bad Request: Error parsing `auth`")
        expect(routeError.errorMessage).toBe("Authorization header is required")
      }
    })

    test("method validation error returns 405", async () => {
      const route = createRoute()
        .parse({
          method: 'POST'
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', { method: 'GET' })

      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PARSE_ERROR')
        expect(routeError.httpStatus).toBe(405) // Method Not Allowed
        expect(routeError.message).toBe("Bad Request: Error parsing `method`")
      }
    })

    test("path validation error returns 404", async () => {
      const route = createRoute()
        .parse({
          path: '/api/users'
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/api/posts')

      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorCode).toBe('PARSE_ERROR')
        expect(routeError.httpStatus).toBe(404) // Not Found
        expect(routeError.message).toBe("Bad Request: Error parsing `path`")
      }
    })
  })

  describe("Integration with Prepare", () => {
    test("parse steps have access to prepare context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { userId: '123' }
        })
        .parse({
          body: async (body, ctx) => {
            // Should have access to prepare context
            expect(ctx.userId).toBe('123')
            const parsed = body as { message: string }
            return { message: data.message }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.userId).toBe('123')
          expect(ctx.parsed.body.message).toBe('hello from user 123')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ message: 'hello' })
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })
})

describe("Stage 6: Enhanced Predefined Parse Fields", () => {
  describe("Type Safety Improvements", () => {
    test("predefined fields have proper type separation from custom fields", async () => {
      // This test verifies that predefined and custom fields can coexist
      const route = createRoute()
        .parse({
          // Predefined field with proper typing
          headers: async (headers, ctx) => {
            // headers should be typed as Headers
            expect(headers instanceof Headers).toBe(true)
            const userAgent = headers.get('user-agent')
            return { userAgent: userAgent || 'unknown' }
          },
          // Custom field with Request access
          requestInfo: async (req, ctx) => {
            // req should be typed as Request
            expect(req instanceof Request).toBe(true)
            return { method: req.method, url: req.url }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.headers.userAgent).toBe('test-browser')
          expect(ctx.parsed.requestInfo.method).toBe('GET')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'user-agent': 'test-browser' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("mixed predefined and custom parsing works correctly", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            const data = body as { id: number }
            return { id: data.id }
          },
          auth: async (authHeader, ctx) => {
            return { token: authHeader.replace('Bearer ', '') }
          },
          customValidator: async (req, ctx) => {
            const url = new URL(req.url)
            return { hasParams: url.searchParams.has('validate') }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.id).toBe(123)
          expect(ctx.parsed.auth.token).toBe('abc123')
          expect(ctx.parsed.customValidator.hasParams).toBe(true)
          return { allParsed: true }
        })

      const mockRequest = new Request('http://localhost/test?validate=true', {
        method: 'POST',
        body: JSON.stringify({ id: 123 }),
        headers: { 'authorization': 'Bearer abc123' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ allParsed: true })
    })
  })

  describe("Enhanced Error Handling", () => {
    test("proper error status codes for different field types", async () => {
      const route = createRoute()
        .parse({
          method: 'POST',
          path: '/api/users'
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      // Test method validation
      const wrongMethodRequest = new Request('http://localhost/api/users', { method: 'GET' })
      try {
        await route(wrongMethodRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.httpStatus).toBe(405) // Method Not Allowed
      }

      // Test path validation  
      const wrongPathRequest = new Request('http://localhost/api/posts', { method: 'POST' })
      try {
        await route(wrongPathRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.httpStatus).toBe(404) // Not Found
      }
    })

    test("field-specific error messages", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            const data = body as { name: string }
            if (!data.name) {
              throw new Error("Name field is required")
            }
            return { name: data.name }
          }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({}) // Missing name field
      })

      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.message).toBe("Bad Request: Error parsing `body`")
        expect(routeError.errorMessage).toBe("Name field is required")
        expect(routeError.errorCode).toBe('PARSE_ERROR')
      }
    })
  })

  describe("Advanced Body Parsing", () => {
    test("handle non-JSON body gracefully", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            // Should receive text when JSON parsing fails
            expect(typeof body).toBe('string')
            return { rawText: body as string }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.rawText).toBe('plain text data')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: 'plain text data'
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("handle empty body", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            // Empty body should be empty string
            expect(body).toBe('')
            return { isEmpty: true }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.isEmpty).toBe(true)
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: ''
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Enhanced Cookie Parsing", () => {
    test("handle malformed cookies gracefully", async () => {
      const route = createRoute()
        .parse({
          cookies: async (cookies, ctx) => {
            // Should parse valid cookies and ignore malformed ones
            return { validCookies: Object.keys(cookies).length }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.cookies.validCookies).toBe(2) // Only valid cookies counted
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'cookie': 'valid1=value1; invalid; valid2=value2; =emptykey' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("handle empty cookie header", async () => {
      const route = createRoute()
        .parse({
          cookies: async (cookies, ctx) => {
            expect(cookies).toEqual({})
            return { hasCookies: false }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.cookies.hasCookies).toBe(false)
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Enhanced Method Validation", () => {
    test("support multiple allowed methods", async () => {
      const route = createRoute()
        .parse({
          method: ['GET', 'POST']
        })
        .handle(async (req, ctx) => {
          return { method: ctx.parsed.method }
        })

      // Test GET
      const getRequest = new Request('http://localhost/test', { method: 'GET' })
      const getResult = await route(getRequest)
      expect(getResult).toEqual({ method: 'GET' })

      // Test POST
      const postRequest = new Request('http://localhost/test', { method: 'POST' })
      const postResult = await route(postRequest)
      expect(postResult).toEqual({ method: 'POST' })

      // Test disallowed method
      const putRequest = new Request('http://localhost/test', { method: 'PUT' })
      try {
        await route(putRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.httpStatus).toBe(405)
        expect(routeError.errorMessage).toContain('GET, POST')
      }
    })
  })

  describe("Integration with Context Building", () => {
    test("parse results integrate with prepare context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { requestId: 'req-123' }
        })
        .parse({
          auth: async (authHeader, ctx) => {
            // Should have access to prepare context
            expect(ctx.requestId).toBe('req-123')
            return { userId: 'user-456' }
          },
          body: async (body, ctx) => {
            // Should have access to both prepare context and previous parse results
            expect(ctx.requestId).toBe('req-123')
            // Note: ctx doesn't have parsed results from same parse call yet
            const data = body as { message: string }
            return { message: data.message }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.requestId).toBe('req-123')
          expect(ctx.parsed.auth.userId).toBe('user-456')
          expect(ctx.parsed.body.message).toBe('hello')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ message: 'hello' }),
        headers: { 'authorization': 'Bearer token123' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })
})

describe("Stage 7: Type Narrowing & Multiple Parse", () => {
  describe("Multiple Parse Calls on Same Field", () => {
    test("merge object results for type narrowing", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            // First validation - basic structure
            const data = body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (body, ctx) => {
            // Second validation - type narrowing with additional fields
            const data = body as { email: string, age: number }
            return { age: data.age, isValid: true }
          }
        })
        .handle(async (req, ctx) => {
          // Should have merged body results: { email, age, isValid }
          expect(ctx.parsed.body.email).toBe('test@example.com')
          expect(ctx.parsed.body.age).toBe(25)
          expect(ctx.parsed.body.isValid).toBe(true)
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', age: 25 })
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("last wins for non-object fields", async () => {
      const route = createRoute()
        .parse({
          auth: async (authHeader, ctx) => {
            return { token: 'first-token' }
          }
        })
        .parse({
          auth: async (authHeader, ctx) => {
            return { token: 'second-token' } // This should override
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.auth.token).toBe('second-token')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'authorization': 'Bearer test' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Progressive Type Refinement", () => {
    test("multiple parse calls progressively build types", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            const data = body as { name: string }
            return { name: data.name }
          }
        })
        .parse({
          auth: async (authHeader, ctx) => {
            return { userId: '123' }
          }
        })
        .parse({
          body: async (body, ctx) => {
            // Additional validation on body
            const data = body as { name: string, email: string }
            return { email: data.email, validated: true }
          }
        })
        .handle(async (req, ctx) => {
          // Should have: body: { name, email, validated }, auth: { userId }
          expect(ctx.parsed.body.name).toBe('John')
          expect(ctx.parsed.body.email).toBe('john@example.com')
          expect(ctx.parsed.body.validated).toBe(true)
          expect(ctx.parsed.auth.userId).toBe('123')
          return { allValidated: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
        headers: { 'authorization': 'Bearer token123' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ allValidated: true })
    })

    test("type narrowing works with custom fields", async () => {
      const route = createRoute()
        .parse({
          customValidator: async (req, ctx) => {
            return { step1: 'validated' }
          }
        })
        .parse({
          customValidator: async (req, ctx) => {
            return { step2: 'also-validated' }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.customValidator.step1).toBe('validated')
          expect(ctx.parsed.customValidator.step2).toBe('also-validated')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Context Access in Later Parse Calls", () => {
    test("later parse calls have access to prepare context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { userId: 'user123' }
        })
        .parse({
          body: async (body, ctx) => {
            expect(ctx.userId).toBe('user123')
            return { step1: 'complete' }
          }
        })
        .parse({
          headers: async (headers, ctx) => {
            // Should have access to prepare context
            expect(ctx.userId).toBe('user123')
            return { userAgent: headers.get('user-agent') || 'unknown' }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.userId).toBe('user123')
          expect(ctx.parsed.body.step1).toBe('complete')
          expect(ctx.parsed.headers.userAgent).toBe('test-agent')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'user-agent': 'test-agent' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("parse calls executed in order with cumulative context", async () => {
      const executionOrder: string[] = []

      const route = createRoute()
        .parse({
          step1: async (req, ctx) => {
            executionOrder.push('parse-step1')
            return { value: 'first' }
          }
        })
        .parse({
          step2: async (req, ctx) => {
            executionOrder.push('parse-step2')
            // Note: ctx doesn't have parsed results from same execution cycle
            return { value: 'second' }
          }
        })
        .parse({
          step3: async (req, ctx) => {
            executionOrder.push('parse-step3')
            return { value: 'third' }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          expect(ctx.parsed.step1.value).toBe('first')
          expect(ctx.parsed.step2.value).toBe('second')
          expect(ctx.parsed.step3.value).toBe('third')
          return { executionOrder }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      
      expect(result.executionOrder).toEqual(['parse-step1', 'parse-step2', 'parse-step3', 'handle'])
    })
  })

  describe("Complex Type Narrowing Scenarios", () => {
    test("multiple validations on same field with error handling", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            const data = body as { email: string }
            if (!data.email) throw new Error("Email required")
            return { email: data.email }
          }
        })
        .parse({
          body: async (body, ctx) => {
            const data = body as { email: string }
            if (!data.email.includes('@')) throw new Error("Invalid email format")
            return { emailValid: true }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.email).toBe('test@example.com')
          expect(ctx.parsed.body.emailValid).toBe(true)
          return { validated: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' })
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ validated: true })

      // Test error in second validation
      const invalidRoute = createRoute()
        .parse({
          body: async (body, ctx) => {
            const data = body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (body, ctx) => {
            const data = body as { email: string }
            if (!data.email.includes('@')) throw new Error("Invalid email")
            return { emailValid: true }
          }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const invalidRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid-email' })
      })

      try {
        await invalidRoute(invalidRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
        const routeError = error as RouteError
        expect(routeError.errorMessage).toBe("Invalid email")
      }
    })

    test("mixed predefined and custom fields with type narrowing", async () => {
      const route = createRoute()
        .parse({
          body: async (body, ctx) => {
            return { step1: 'body-parsed' }
          },
          customField: async (req, ctx) => {
            return { step1: 'custom-parsed' }
          }
        })
        .parse({
          body: async (body, ctx) => {
            return { step2: 'body-enhanced' }
          },
          customField: async (req, ctx) => {
            return { step2: 'custom-enhanced' }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.step1).toBe('body-parsed')
          expect(ctx.parsed.body.step2).toBe('body-enhanced')
          expect(ctx.parsed.customField.step1).toBe('custom-parsed')
          expect(ctx.parsed.customField.step2).toBe('custom-enhanced')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })
  })

  describe("Integration with Previous Stages", () => {
    test("type narrowing works with prepare context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { requestId: 'req-789' }
        })
        .parse({
          auth: async (authHeader, ctx) => {
            expect(ctx.requestId).toBe('req-789')
            return { userId: 'user-456' }
          }
        })
        .parse({
          auth: async (authHeader, ctx) => {
            expect(ctx.requestId).toBe('req-789')
            return { role: 'admin' }
          }
        })
        .handle(async (req, ctx) => {
          expect(ctx.requestId).toBe('req-789')
          expect(ctx.parsed.auth.userId).toBe('user-456')
          expect(ctx.parsed.auth.role).toBe('admin')
          return { authorized: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        headers: { 'authorization': 'Bearer token123' }
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ authorized: true })
    })
  })
})

describe("Stage 8: Request Lifecycle Integration", () => {
  describe("Enhanced Lifecycle Hooks", () => {
    test("lifecycle hooks receive metadata with timestamp and requestId", async () => {
      const hookCalls: Array<{ hook: string, metadata: any }> = []
      
      const route = createRoute({
        onRequest: async (req, metadata) => {
          hookCalls.push({ hook: 'onRequest', metadata })
          expect(typeof metadata.timestamp).toBe('number')
          expect(typeof metadata.requestId).toBe('string')
          expect(metadata.requestId).toMatch(/^req-[a-z0-9]+$/)
        },
        onResponse: async (res, metadata) => {
          hookCalls.push({ hook: 'onResponse', metadata })
          expect(typeof metadata.timestamp).toBe('number')
          expect(typeof metadata.requestId).toBe('string')
          expect(typeof metadata.duration).toBe('number')
          expect(metadata.duration).toBeGreaterThanOrEqual(0)
        },
        generateRequestId: () => 'test-request-123'
      }).handle(async (req, ctx) => {
        return { success: true }
      })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)
      
      expect(result).toEqual({ success: true })
      expect(hookCalls).toHaveLength(2)
      expect(hookCalls[0].metadata.requestId).toBe('test-request-123')
      expect(hookCalls[1].metadata.requestId).toBe('test-request-123')
    })

    test("onError hook receives stage information", async () => {
      let errorMetadata: any = null
      
      const route = createRoute({
        onError: async (err, metadata) => {
          errorMetadata = metadata
        }
      })
        .prepare(async () => { throw new Error("Prepare stage error") })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
      }
      
      expect(errorMetadata).not.toBeNull()
      expect(errorMetadata.stage).toBe('prepare')
      expect(typeof errorMetadata.timestamp).toBe('number')
      expect(typeof errorMetadata.requestId).toBe('string')
    })

    test("response headers include metadata", async () => {
      let responseHeaders: Headers | null = null
      
      const route = createRoute({
        onResponse: async (res, metadata) => {
          responseHeaders = res.headers
        },
        generateRequestId: () => 'custom-id-456'
      }).handle(async (req, ctx) => {
        return { message: 'hello' }
      })

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)
      
      expect(responseHeaders).not.toBeNull()
      expect(responseHeaders!.get('X-Request-ID')).toBe('custom-id-456')
      expect(responseHeaders!.get('X-Duration')).not.toBeNull()
      expect(Number.parseInt(responseHeaders!.get('X-Duration')!)).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Stage-Specific Lifecycle Hooks", () => {
    test("prepare lifecycle hooks execute in correct order", async () => {
      const executionOrder: string[] = []
      
      const route = createRoute({
        onRequest: async () => { executionOrder.push('onRequest') },
        onPrepareStart: async () => { executionOrder.push('onPrepareStart') },
        onPrepareCompleted: async () => { executionOrder.push('onPrepareCompleted') },
        onParseStart: async () => { executionOrder.push('onParseStart') },
        onParseComplete: async () => { executionOrder.push('onParseComplete') },
        onResponse: async () => { executionOrder.push('onResponse') }
      })
        .prepare(async (req, ctx) => {
          executionOrder.push('prepare')
          return { role: 'admin' }
        })
        .parse({
          body: async (body: any, ctx: any) => {
            executionOrder.push('parse')
            return { parsed: true }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      })
      await route(mockRequest)
      
      expect(executionOrder).toEqual([
        'onRequest',
        'onPrepareStart',
        'prepare',
        'onPrepareCompleted',
        'onParseStart',
        'parse',
        'onParseComplete',
        'handle',
        'onResponse'
      ])
    })

    test("prepare hooks receive correct context", async () => {
      let prepareStartContext: any = null
      let prepareCompleteContext: any = null
      
      const route = createRoute({
        onPrepareStart: async (req: Request) => {
          prepareStartContext = 'no-context-yet'
        },
        onPrepareCompleted: async (req: any, context: any) => {
          prepareCompleteContext = context
        }
      })
        .prepare(async (req, ctx) => {
          return { userId: '123', role: 'admin' }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)
      
      expect(prepareStartContext).toBe('no-context-yet')
      expect(prepareCompleteContext).toEqual({ requestId: expect.any(String), userId: '123', role: 'admin' })
    })

    test("parse hooks receive prepare context", async () => {
      let parseStartContext: any = null
      let parseCompleteContext: any = null
      
      const route = createRoute({
        onParseStart: async (req, context) => {
          parseStartContext = context
        },
        onParseComplete: async (req, context) => {
          parseCompleteContext = context
        }
      })
        .prepare(async (req, ctx) => {
          return { prepared: true }
        })
        .parse({
          body: async (body, ctx) => {
            return { name: 'test' }
          }
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ name: 'test' })
      })
      await route(mockRequest)
      
      expect(parseStartContext).toEqual({ prepared: true })
      expect(parseCompleteContext.prepared).toBe(true)
      expect(parseCompleteContext.parsed).toEqual({ body: { name: 'test' } })
    })
  })

  describe("Error Propagation Enhancement", () => {
    test("errors in different stages are correctly identified", async () => {
      const errorStages: string[] = []
      
      const prepareErrorRoute = createRoute({
        onError: async (err, metadata) => {
          errorStages.push(metadata.stage)
        }
      })
        .prepare(async () => { throw new Error("Prepare error") })
        .handle(async () => ({ success: true }))

      const parseErrorRoute = createRoute({
        onError: async (err, metadata) => {
          errorStages.push(metadata.stage)
        }
      })
        .parse({
          body: async () => { throw new Error("Parse error") }
        })
        .handle(async () => ({ success: true }))

      const handleErrorRoute = createRoute({
        onError: async (err, metadata) => {
          errorStages.push(metadata.stage)
        }
      }).handle(async () => { 
        throw new Error("Handle error") 
      })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: '{}'
      })

      // Test prepare error
      try { await prepareErrorRoute(mockRequest) } catch {}
      
      // Test parse error  
      try { await parseErrorRoute(mockRequest) } catch {}
      
      // Test handle error
      try { await handleErrorRoute(mockRequest) } catch {}
      
      expect(errorStages).toEqual(['prepare', 'parse', 'handle'])
    })

    test("RouteError preservation through error hooks", async () => {
      let capturedError: Error | null = null
      
      const customRouteError = new RouteError("Custom validation error", {
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Invalid input data',
        httpStatus: 422
      })

      const route = createRoute({
        onError: async (err, metadata) => {
          capturedError = err
        }
      })
        .prepare(async () => {
          throw customRouteError
        })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error).toBe(customRouteError)
      }
      
      expect(capturedError).toBe(customRouteError)
    })
  })

  describe("Invoke Method Lifecycle Integration", () => {
    test("invoke method triggers prepare/parse lifecycle hooks", async () => {
      const hookCalls: string[] = []
      
      const route = createRoute({
        onPrepareStart: async () => { hookCalls.push('onPrepareStart') },
        onPrepareCompleted: async () => { hookCalls.push('onPrepareCompleted') },
        onParseStart: async () => { hookCalls.push('onParseStart') },
        onParseComplete: async () => { hookCalls.push('onParseComplete') }
      })
        .prepare(async () => {
          hookCalls.push('prepare')
          return { role: 'admin' }
        })
        .parse({
          headers: async (headers: any, ctx: any) => {
            hookCalls.push('parse')
            return { userAgent: 'test' }
          }
        })
        .handle(async (req, ctx) => {
          hookCalls.push('handle')
          return { success: true }
        })

      const result = await route.invoke()
      
      expect(result).toEqual({ success: true })
      expect(hookCalls).toEqual([
        'onPrepareStart',
        'prepare',
        'onPrepareCompleted',
        'onParseStart',
        'parse',
        'onParseComplete',
        'handle'
      ])
    })

    test("invoke with context override skips lifecycle hooks", async () => {
      const hookCalls: string[] = []
      
      const route = createRoute({
        onPrepareStart: async () => { hookCalls.push('onPrepareStart') },
        onPrepareCompleted: async () => { hookCalls.push('onPrepareCompleted') },
        onParseStart: async () => { hookCalls.push('onParseStart') },
        onParseComplete: async () => { hookCalls.push('onParseComplete') }
      })
        .prepare(async () => {
          hookCalls.push('prepare')
          return { role: 'admin' }
        })
        .handle(async (req, ctx) => {
          hookCalls.push('handle')
          return { context: ctx }
        })

      // Use type assertion for complex context type
      const customContext = { customField: 'value' } as any
      const result = await route.invoke(customContext)
      
      expect(hookCalls).toEqual(['handle']) // Only handle should be called
      expect(result.context.customField).toBe('value')
    })

    test("invoke error handling includes metadata", async () => {
      let errorMetadata: any = null
      
      const route = createRoute({
        onError: async (err, metadata) => {
          errorMetadata = metadata
        },
        generateRequestId: () => 'invoke-test-id'
      })
        .parse({
          body: async () => { throw new Error("Parse error in invoke") }
        })
        .handle(async () => ({ success: true }))

      try {
        await route.invoke()
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
      }
      
      expect(errorMetadata).not.toBeNull()
      expect(errorMetadata.stage).toBe('parse')
      expect(errorMetadata.requestId).toBe('invoke-test-id')
    })
  })

  describe("Performance and Optimization", () => {
    test("request duration tracking is accurate", async () => {
      let measuredDuration: number = 0
      const delayMs = 50
      
      const route = createRoute({
        onResponse: async (res, metadata) => {
          measuredDuration = metadata.duration
        }
      })
        .prepare(async () => {
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, delayMs))
          return { processed: true }
        })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)
      
      expect(measuredDuration).toBeGreaterThanOrEqual(delayMs - 10) // Allow some variance
      expect(measuredDuration).toBeLessThan(delayMs + 50) // Reasonable upper bound
    })

    test("custom request ID generation works correctly", async () => {
      let generatedIds: string[] = []
      let callCount = 0
      
      const route = createRoute({
        generateRequestId: () => `custom-${++callCount}`,
        onRequest: async (req, metadata) => {
          generatedIds.push(metadata.requestId)
        }
      }).handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      
      await route(mockRequest)
      await route(mockRequest)
      
      expect(generatedIds).toEqual(['custom-1', 'custom-2'])
    })
  })

  describe("Backward Compatibility", () => {
    test("existing lifecycle hooks still work without metadata", async () => {
      let legacyHooksCalled = 0
      
      // Test that existing hooks that don't expect metadata still work
      const route = createRoute({
        onRequest: async (req) => { 
          legacyHooksCalled++
          expect(req instanceof Request).toBe(true)
        },
        onResponse: async (res) => { 
          legacyHooksCalled++
          expect(res instanceof Response).toBe(true)
        },
        onError: async (err) => { 
          legacyHooksCalled++
          expect(err instanceof Error).toBe(true)
        }
      })
        .prepare(async () => {
          throw new Error("Test error")
        })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      
      try {
        await route(mockRequest)
      } catch (error) {
        // Expected error
      }
      
      expect(legacyHooksCalled).toBe(2) // onRequest and onError should be called
    })
  })
})
