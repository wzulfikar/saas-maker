import { describe, test, expect } from "bun:test"
import { createRoute, RouteError } from "./createRoute"
import type { Expect, Eq } from "../types-helper"

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
      const builder = createRoute()
        .parse({
          body: async (ctx) => {
            type TestBodyIsNotAny = Expect<Eq<typeof ctx.body, Record<string, unknown>>>
            return { name: "test" }
          }
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
          body: async (ctx) => {
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
          headers: async (ctx) => {
            return { userAgent: "test-agent" }
          }
        })
        .parse({
          body: async (ctx) => {
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
          headers: async (ctx) => {
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
          body: async (ctx) => {
            // First validation - basic structure
            return { name: "test" as string }
          }
        })
        .parse({
          body: async (ctx) => {
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

    test("last wins for multiple parse calls on same field", async () => {
      const route = createRoute()
        .parse({
          body: async (ctx) => {
            // First validation - basic structure
            const data = ctx.body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (ctx) => {
            // Second validation - overrides the first one (last wins)
            return { age: ctx.body.age as number, isValid: true }
          }
        })
        .handle(async (req, ctx) => {
          // Should have only the last parse result: { age, isValid }
          // email should NOT be present since it was overridden

          type TestParsedBody = Expect<Eq<typeof ctx.parsed.body, { age: number, isValid: boolean }>>

          expect(ctx.parsed.body).toEqual({ age: 25, isValid: true })
          expect('email' in ctx.parsed.body).toBe(false) // email was overridden
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', age: 25 })
      })
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("manual merge with previous parse results if desired", async () => {
      const route = createRoute()
        .parse({
          body: async (ctx) => {
            // First validation - basic structure
            const data = ctx.body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (ctx) => {
            // Second validation - manually merge with previous results
            const data = ctx.body as { email: string, age: number }
            return { ...ctx.parsed.body, age: data.age, isValid: true }
          }
        })
        .handle(async (req, ctx) => {
          // Should have merged results since we manually spread
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
        body: async (ctx) => ({ name: "test" })
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
          headers: async (ctx) => ({ userAgent: "test" })
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
          headers: async (ctx) => ({ userAgent: "test" })
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
      }
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
      body: async (ctx) => ({ name: "test" })
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

    test("invoke with context override merges with prepare results", async () => {
      let prepareCalled = false

      const route = createRoute()
        .prepare(async (req, ctx) => {
          prepareCalled = true
          return { role: "admin" }
        })
        .handle(async (req, ctx) => {
          return { ctx }
        })

      const customContext = { customField: "value" }
      // @ts-expect-error type of customContext doesn't satisfy invoke arg
      const result = await route.invoke(customContext)

      // Partial context overrides should still run prepare steps
      expect(prepareCalled).toBe(true)
      // Context should merge: custom field + prepare result
      // @ts-expect-error arg of .toEqual doesn't satisify result.ctx
      expect(result.ctx).toEqual({ customField: "value", role: "admin" })
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
          headers: async (ctx) => {
            const userAgent = ctx.headers.get('user-agent')
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
          body: async (ctx) => {
            const parsed = ctx.body as { name: string, age: number }
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
          query: async (ctx) => {
            const params = ctx.query
            return {
              search: params.search || '',
              page: Number.parseInt(params.page || '1')
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
          cookies: async (ctx) => {
            const parsed = ctx.cookies as Record<string, string>
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
          auth: async (ctx) => {
            const token = ctx.authHeader.replace('Bearer ', '')
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

  // describe("Custom Field Parsing", () => {
  //   test("parse custom field", async () => {
  //     const route = createRoute()
  //       .parse({
  //         customField: async (ctx) => {
  //           const url = new URL(req.url)
  //           return { host: url.hostname }
  //         }
  //       })
  //       .handle(async (req, ctx) => {
  //         expect(ctx.parsed.customField).toEqual({ host: 'localhost' })
  //         return { success: true }
  //       })

  //     const mockRequest = new Request('http://localhost/test')
  //     const result = await route(mockRequest)
  //     expect(result).toEqual({ success: true })
  //   })

  //   test("parse multiple custom fields", async () => {
  //     const route = createRoute()
  //       .parse({
  //         timestamp: async (ctx) => {
  //           return { value: Date.now() }
  //         },
  //         requestId: async (ctx) => {
  //           return { id: Math.random().toString(36) }
  //         }
  //       })
  //       .handle(async (req, ctx) => {
  //         type TestTypeOfTimestamp = Expect<Eq<typeof ctx.parsed.timestamp, { value: number }>>
  //         type TestTypeOfRequestId = Expect<Eq<typeof ctx.parsed.requestId, { id: string }>>

  //         expect(typeof ctx.parsed.timestamp.value).toBe('number')
  //         expect(typeof ctx.parsed.requestId.id).toBe('string')
  //         return { success: true }
  //       })

  //     const mockRequest = new Request('http://localhost/test')
  //     const result = await route(mockRequest)
  //     expect(result).toEqual({ success: true })
  //   })
  // })

  describe("Mixed Parsing", () => {
    test("parse predefined and custom fields together", async () => {
      const route = createRoute()
        .parse({
          auth: async (ctx) => {
            type TestAuthHeaderIsString = Expect<Eq<typeof ctx.authHeader, string>>
            return { token: ctx.authHeader.replace('Bearer ', '') }
          },
          body: async (ctx) => {
            const parsed = ctx.body as { name: string }
            return { name: parsed.name }
          },
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.auth.token).toBe('test-token')
          expect(ctx.parsed.body.name).toBe('test')
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
          body: async (ctx) => {
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
          auth: async (ctx) => {
            return { token: ctx.authHeader }
          },
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
        .prepare(async (req) => ({
          prepared: true,
          timestamp: Date.now()
        }))
        .parse({
          body: async (ctx) => {
            type TestTypeOfCtxPrepared = Expect<Eq<typeof ctx.prepared, boolean>>
            type TestTypeOfCtxTimestamp = Expect<Eq<typeof ctx.timestamp, number>>
            // Context should include prepare results
            return { name: "parsed" }
          }
        })
        .handle(async (req, ctx) => {
          return {
            prepared: ctx.prepared,
            timestamp: ctx.timestamp,
            custom: ctx.parsed.body.name
          }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)

      expect(result).toEqual({
        prepared: true,
        timestamp: expect.any(Number),
        custom: "parsed"
      })
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
          headers: async (ctx) => {
            // headers should be typed as Headers
            const userAgent = ctx.headers.get('user-agent')
            return { userAgent: userAgent || 'unknown' }
          },
          // Custom field with Request access
          // requestInfo: async (ctx) => {
          //   // req should be typed as Request
          //   expect(req instanceof Request).toBe(true)
          //   return { method: req.method, url: req.url }
          // }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.headers.userAgent).toBe('test-browser')
          // expect(ctx.parsed.requestInfo.method).toBe('GET')
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
          body: async (ctx) => {
            const data = ctx.body as { id: number }
            return { id: data.id }
          },
          auth: async (ctx) => {
            return { token: ctx.authHeader.replace('Bearer ', '') }
          },
          // customValidator: async (ctx) => {
          //   const url = new URL(req.url)
          //   return { hasParams: url.searchParams.has('validate') }
          // }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.id).toBe(123)
          expect(ctx.parsed.auth.token).toBe('abc123')
          // expect(ctx.parsed.customValidator.hasParams).toBe(true)
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
          body: async (ctx) => {
            const data = ctx.body as { name: string }
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
          body: async (ctx) => {
            // Body is now consistently Record<string, unknown> - for non-JSON it becomes {text: "..."}
            expect(typeof ctx.body).toBe('object')
            const data = ctx.body as { text: string }
            return { rawText: data.text }
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
          body: async (ctx) => {
            // Empty body is now consistently an empty object
            expect(ctx.body).toEqual({})
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
          cookies: async (ctx) => {
            // Should parse valid cookies and ignore malformed ones
            return { validCookies: Object.keys(ctx.cookies).length }
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
          cookies: async (ctx) => {
            expect(ctx.cookies).toEqual({})
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
          type TestRouteMethod = Expect<Eq<typeof ctx.parsed.method, 'GET' | 'POST'>>
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
          auth: async (ctx) => {
            // Should have access to prepare context
            expect(ctx.requestId).toBe('req-123')
            return { userId: 'user-456' }
          },
          body: async (ctx) => {
            // Should have access to both prepare context and previous parse results
            expect(ctx.requestId).toBe('req-123')
            // Note: ctx doesn't have parsed results from same parse call yet
            const data = ctx.body as { message: string }
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
          body: async (ctx) => {
            // First validation - basic structure
            const data = ctx.body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (ctx) => {
            // Second validation - type narrowing with additional fields
            const data = ctx.body as { email: string, age: number }
            return { age: data.age, isValid: true }
          }
        })
        .handle(async (req, ctx) => {
          // Should have merged body results: { email, age, isValid }
          // @ts-expect-error email is not in ctx.parsed.body because it's been overridden
          expect(ctx.parsed.body.email).toBe(undefined)
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
          auth: async (ctx) => {
            return { token: 'first-token' }
          }
        })
        .parse({
          auth: async (ctx) => {
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
    // test("multiple parse calls progressively build types", async () => {
    //   const route = createRoute()
    //     .parse({
    //       body: async (ctx) => {
    //         const data = ctx.body as { name: string }
    //         return { name: data.name }
    //       }
    //     })
    //     .parse({
    //       auth: async (ctx) => {
    //         return { userId: '123' }
    //       }
    //     })
    //     .parse({
    //       body: async (ctx) => {
    //         // Additional validation on body
    //         const data = ctx.body as { name: string, email: string }
    //         return { email: data.email, validated: true }
    //       }
    //     })
    //     .handle(async (req, ctx) => {
    //       // Should have: body: { name, email, validated }, auth: { userId }
    //       expect(ctx.parsed.body.name).toBe('John')
    //       expect(ctx.parsed.body.email).toBe('john@example.com')
    //       expect(ctx.parsed.body.validated).toBe(true)
    //       expect(ctx.parsed.auth.userId).toBe('123')
    //       return { allValidated: true }
    //     })

    //   const mockRequest = new Request('http://localhost/test', {
    //     method: 'POST',
    //     body: JSON.stringify({ name: 'John', email: 'john@example.com' }),
    //     headers: { 'authorization': 'Bearer token123' }
    //   })
    //   const result = await route(mockRequest)
    //   expect(result).toEqual({ allValidated: true })
    // })

    // test("type narrowing works with custom fields", async () => {
    //   const route = createRoute()
    //     .parse({
    //       customValidator: async (ctx) => {
    //         return { step1: 'validated' }
    //       }
    //     })
    //     .parse({
    //       customValidator: async (ctx) => {
    //         return { step2: 'also-validated' }
    //       }
    //     })
    //     .handle(async (req, ctx) => {
    //       expect(ctx.parsed.customValidator.step1).toBe('validated')
    //       expect(ctx.parsed.customValidator.step2).toBe('also-validated')
    //       return { success: true }
    //     })

    //   const mockRequest = new Request('http://localhost/test')
    //   const result = await route(mockRequest)
    //   expect(result).toEqual({ success: true })
    // })
  })

  describe("Context Access in Later Parse Calls", () => {
    test("later parse calls have access to prepare context", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { userId: 'user123' }
        })
        .parse({
          body: async (ctx) => {
            expect(ctx.userId).toBe('user123')
            return { step1: 'complete' }
          }
        })
        .parse({
          headers: async (ctx) => {
            // Should have access to prepare context
            expect(ctx.userId).toBe('user123')
            return { userAgent: ctx.headers.get('user-agent') || 'unknown' }
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

    // test("parse calls executed in order with cumulative context", async () => {
    //   const executionOrder: string[] = []

    //   const route = createRoute()
    //     .parse({
    //       step1: async (ctx) => {
    //         executionOrder.push('parse-step1')
    //         return { value: 'first' }
    //       }
    //     })
    //     .parse({
    //       step2: async (ctx) => {
    //         executionOrder.push('parse-step2')
    //         // Note: ctx doesn't have parsed results from same execution cycle
    //         return { value: 'second' }
    //       }
    //     })
    //     .parse({
    //       step3: async (ctx) => {
    //         executionOrder.push('parse-step3')
    //         return { value: 'third' }
    //       }
    //     })
    //     .handle(async (req, ctx) => {
    //       executionOrder.push('handle')
    //       expect(ctx.parsed.step1.value).toBe('first')
    //       expect(ctx.parsed.step2.value).toBe('second')
    //       expect(ctx.parsed.step3.value).toBe('third')
    //       return { executionOrder }
    //     })

    //   const mockRequest = new Request('http://localhost/test')
    //   const result = await route(mockRequest)

    //   expect(result.executionOrder).toEqual(['parse-step1', 'parse-step2', 'parse-step3', 'handle'])
    // })
  })

  describe("Complex Type Narrowing Scenarios", () => {
    test("multiple validations on same field with error handling", async () => {
      const route = createRoute()
        .parse({
          body: async (ctx) => {
            const data = ctx.body as { email: string }
            if (!data.email) throw new Error("Email required")
            return { email: data.email }
          }
        })
        .parse({
          body: async (ctx) => {
            const data = ctx.body as { email: string }
            if (!data.email.includes('@')) throw new Error("Invalid email format")
            return { emailValid: true }
          }
        })
        .handle(async (req, ctx) => {
          // @ts-expect-error email is not in ctx.parsed.body because it's been overridden
          expect(ctx.parsed.body.email).toBe(undefined)
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
          body: async (ctx) => {
            const data = ctx.body as { email: string }
            return { email: data.email }
          }
        })
        .parse({
          body: async (ctx) => {
            const data = ctx.body as { email: string }
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
          body: async (ctx) => {
            return { step1: 'body-parsed' }
          },
          // customField: async (ctx) => {
          //   return { step1: 'custom-parsed' }
          // }
        })
        .parse({
          body: async (ctx) => {
            return { ...ctx.parsed.body, step2: 'body-enhanced' }
          },
          // customField: async (ctx) => {
          //   return { step2: 'custom-enhanced' }
          // }
        })
        .handle(async (req, ctx) => {
          expect(ctx.parsed.body.step1).toBe('body-parsed')
          expect(ctx.parsed.body.step2).toBe('body-enhanced')
          // expect(ctx.parsed.customField.step1).toBe('custom-parsed')
          // expect(ctx.parsed.customField.step2).toBe('custom-enhanced')
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
          auth: async (ctx) => {
            expect(ctx.requestId).toBe('req-789')
            return { userId: 'user-456' }
          }
        })
        .parse({
          auth: async (ctx) => {
            expect(ctx.requestId).toBe('req-789')
            return { ...ctx.parsed.auth, role: 'admin' }
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
    test("simplified lifecycle hooks work without metadata", async () => {
      const hookCalls: string[] = []

      const route = createRoute({
        onRequest: async (req) => {
          hookCalls.push('onRequest')
        },
        onResponse: async (res) => {
          hookCalls.push('onResponse')
        }
      }).handle(async (req, ctx) => {
        return { success: true }
      })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)

      expect(result).toEqual({ success: true })
      expect(hookCalls).toEqual(['onRequest', 'onResponse'])
    })

    test("onError hook works without metadata", async () => {
      let errorCaught = false

      const route = createRoute({
        onError: async (err) => {
          errorCaught = true
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

      expect(errorCaught).toBe(true)
    })
  })

  describe("Simplified Lifecycle", () => {
    test("basic lifecycle hooks execute in correct order", async () => {
      const executionOrder: string[] = []

      const route = createRoute({
        onRequest: async () => { executionOrder.push('onRequest') },
        onResponse: async () => { executionOrder.push('onResponse') }
      })
        .prepare(async (req, ctx) => {
          executionOrder.push('prepare')
          return { role: 'admin' }
        })
        .parse({
          body: async (ctx) => {
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
        'prepare',
        'parse',
        'handle',
        'onResponse'
      ])
    })
  })

  describe("Error Propagation Enhancement", () => {
    test("errors in different stages are correctly handled", async () => {
      let prepareErrorCaught = false
      let parseErrorCaught = false

      const prepareErrorRoute = createRoute({
        onError: async (err) => {
          prepareErrorCaught = true
        }
      })
        .prepare(async () => { throw new Error("Prepare error") })
        .handle(async () => ({ success: true }))

      const parseErrorRoute = createRoute({
        onError: async (err) => {
          parseErrorCaught = true
        }
      })
        .parse({
          body: async () => { throw new Error("Parse error") }
        })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test', {
        method: 'POST',
        body: JSON.stringify({})
      })

      try {
        await prepareErrorRoute(mockRequest)
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
      }

      try {
        await parseErrorRoute(mockRequest)
      } catch (error) {
        expect(error instanceof RouteError).toBe(true)
      }

      expect(prepareErrorCaught).toBe(true)
      expect(parseErrorCaught).toBe(true)
    })
  })

  describe("Invoke Method Lifecycle Integration", () => {
    test("invoke method executes prepare/parse steps", async () => {
      const executionOrder: string[] = []

      const route = createRoute()
        .prepare(async () => {
          executionOrder.push('prepare')
          return { role: 'admin' }
        })
        .parse({
          headers: async (ctx) => {
            executionOrder.push('parse')
            return { userAgent: 'test' }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return { success: true }
        })

      const result = await route.invoke()

      expect(result).toEqual({ success: true })
      expect(executionOrder).toEqual(['prepare', 'parse', 'handle'])
    })

    test("invoke with context override merges with prepare results", async () => {
      const executionOrder: string[] = []

      const route = createRoute()
        .prepare(async () => {
          executionOrder.push('prepare')
          return { role: 'admin' }
        })
        .parse({
          body: async (ctx) => {
            executionOrder.push('parse')
            return { parsed: true }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return {
            success: true,
            context: ctx
          }
        })

      const customContext = { customField: 'value' }
      // @ts-expect-error customContext doesn't satisfy invoke arg
      const result = await route.invoke(customContext)

      expect(executionOrder).toEqual(['prepare', 'parse', 'handle']) // All steps should be called
      // @ts-expect-error customContext doesn't satisfy invoke arg
      expect(result.context).toEqual({ customField: 'value', role: 'admin', parsed: { body: { parsed: true } } })
    })

    test("invoke error handling works correctly", async () => {
      let errorCaught = false

      const route = createRoute({
        onError: async (err) => {
          errorCaught = true
        }
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

      expect(errorCaught).toBe(true)
    })
  })

  describe("Performance and Optimization", () => {
    test("request handling works without duration tracking", async () => {
      let responseReceived = false

      const route = createRoute({
        onResponse: async (res) => {
          responseReceived = true
        }
      })
        .prepare(async () => {
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 10))
          return { processed: true }
        })
        .handle(async () => ({ success: true }))

      const mockRequest = new Request('http://localhost/test')
      await route(mockRequest)

      expect(responseReceived).toBe(true)
    })
  })

  describe("Backward Compatibility", () => {
    test("existing lifecycle hooks work with simplified implementation", async () => {
      let hooksCalls: string[] = []

      // Test that existing hooks work without expecting metadata
      const route = createRoute({
        onRequest: async (req) => {
          hooksCalls.push('onRequest')
          expect(req instanceof Request).toBe(true)
        },
        onResponse: async (res) => {
          hooksCalls.push('onResponse')
          expect(res instanceof Response).toBe(true)
        },
        onError: async (err) => {
          hooksCalls.push('onError')
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

      expect(hooksCalls).toEqual(['onRequest', 'onError']) // onRequest and onError should be called
    })
  })
})

// ===== STAGE 9: FRAMEWORK INTEGRATION & INVOKE TESTS =====
describe("Stage 9: Framework Integration & Invoke", () => {
  describe("Framework Adapters", () => {
    test("nextjs adapter extracts request from NextRequest", async () => {
      const mockNextRequest = new Request('http://localhost:3000/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: 'test' })
      })

      const route = createRoute({
        requestObject: (args) => (Array.isArray(args) ? args : [args])[0] as Request
      })
        .prepare(async (req) => ({ framework: 'nextjs' }))
        .handle(async (req, ctx) => {
          expect(req.url).toBe('http://localhost:3000/api/test')
          expect(req.method).toBe('POST')
          expect(ctx.framework).toBe('nextjs')
          return { success: true }
        })

      const result = await route(mockNextRequest)
      expect(result).toEqual({ success: true })
    })

    test("hono adapter extracts request from Hono context", async () => {
      const mockRequest = new Request('http://localhost/hono', {
        method: 'GET',
        headers: { 'user-agent': 'hono-client' }
      })

      const mockHonoContext = {
        req: mockRequest,
        env: {},
        event: {}
      }

      const route = createRoute({
        requestObject: (args) => (args as { req: Request }).req
      })
        .prepare(async (req) => ({ framework: 'hono' }))
        .handle(async (req, ctx) => {
          expect(req.url).toBe('http://localhost/hono')
          expect(req.method).toBe('GET')
          expect(ctx.framework).toBe('hono')
          return { success: true, framework: 'hono' }
        })

      const result = await route(mockHonoContext)
      expect(result).toEqual({ success: true, framework: 'hono' })
    })

    test("cloudflare adapter handles multiple arguments", async () => {
      const mockRequest = new Request('http://worker.example.com/api', {
        method: 'DELETE',
        headers: { 'authorization': 'Bearer token123' }
      })

      const mockEnv = { SECRET_KEY: 'test' }
      const mockCtx = { waitUntil: () => { } }

      const route = createRoute({
        requestObject: (args) => (Array.isArray(args) ? args : [args])[0] as Request
      })
        .prepare(async (req) => ({ platform: 'cloudflare' }))
        .handle(async (req, ctx) => {
          expect(req.url).toBe('http://worker.example.com/api')
          expect(req.method).toBe('DELETE')
          expect(ctx.platform).toBe('cloudflare')
          return { success: true, platform: 'cloudflare' }
        })

      const result = await route(mockRequest, mockEnv, mockCtx)
      expect(result).toEqual({ success: true, platform: 'cloudflare' })
    })

    test("auto adapter handles standard Request objects", async () => {
      const mockRequest = new Request('http://localhost/auto', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' }
      })

      const route = createRoute() // Uses default auto detection
        .prepare(async (req) => ({ detected: 'auto' }))
        .handle(async (req, ctx) => {
          expect(req.url).toBe('http://localhost/auto')
          expect(req.method).toBe('PATCH')
          expect(ctx.detected).toBe('auto')
          return { success: true, detected: 'auto' }
        })

      const result = await route(mockRequest)
      expect(result).toEqual({ success: true, detected: 'auto' })
    })
  })

  describe("Custom Request Object Mapping", () => {
    test("simple request object extraction", async () => {
      const route = createRoute()
        .prepare(async (req) => ({ created: 'simple' }))
        .handle(async (req, ctx) => {
          expect(ctx.created).toBe('simple')
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/simple')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true })
    })

    test("express-style request object extraction", async () => {
      const route = createRoute({
        requestObject: (args) => {
          const req = (Array.isArray(args) ? args : [args])[0] as Record<string, unknown>

          if (req?.method && req.url) {
            const url = req.protocol ? `${req.protocol}://localhost${req.originalUrl || req.url}`
              : `http://localhost${req.originalUrl || req.url}`
            return new Request(url, {
              method: req.method as string,
              headers: new Headers(req.headers as Record<string, string> || {}),
              body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
            })
          }

          throw new Error('Invalid Express request object')
        }
      })
        .prepare(async (req, ctx) => {
          return { created: 'express-style' }
        })
        .handle(async (req, ctx) => {
          expect(ctx.created).toBe('express-style')
          return { success: true }
        })

      // Mock Express request
      const mockExpressReq = {
        method: 'POST',
        url: '/express-route',
        protocol: 'http',
        headers: { 'content-type': 'application/json' },
        body: { data: 'test' },
        originalUrl: '/express-route'
      }

      const result = await route(mockExpressReq)
      expect(result).toEqual({ success: true })
    })

    test("minimal request mapping", async () => {
      const route = createRoute({
        requestObject: (args) => args as Request
      })
        .prepare(async (req) => ({ runtime: 'minimal' }))
        .handle(async (req, ctx) => {
          expect(ctx.runtime).toBe('minimal')
          return { success: true, runtime: 'minimal' }
        })

      const mockRequest = new Request('http://localhost/minimal')
      const result = await route(mockRequest)
      expect(result).toEqual({ success: true, runtime: 'minimal' })
    })
  })

  describe("Enhanced Invoke Method", () => {
    test("invoke with partial context override", async () => {
      const route = createRoute()
        .prepare(async (req, ctx) => {
          return { prepared: true, userId: 'default-user' }
        })
        .parse({
          auth: async (ctx) => {
            return { token: 'default-token' }
          }
        })
        .handle(async (req, ctx) => {
          return {
            success: true,
            prepared: ctx.prepared,
            userId: ctx.userId,
            auth: ctx.parsed.auth
          }
        })

      // Invoke with partial context override
      const result = await route.invoke({
        parsed: { auth: { token: 'my-token' } },
        userId: 'override-user',
        prepared: true
      })

      console.log('result:', result);
      expect(result).toEqual({
        success: true,
        prepared: true,
        userId: 'override-user', // Overridden
        auth: { token: 'my-token' } // From parse
      })
    })

    test("invoke executes full lifecycle", async () => {
      const executionOrder: string[] = []

      const route = createRoute()
        .prepare(async (req) => {
          executionOrder.push('prepare')
          return { prepared: true }
        })
        .parse({
          headers: async (ctx) => {
            executionOrder.push('parse')
            return { parsed: true }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return { success: true }
        })

      await route.invoke()

      expect(executionOrder).toEqual(['prepare', 'parse', 'handle'])
    })

    test("invoke with complete context override skips prepare/parse", async () => {
      const executionOrder: string[] = []

      const route = createRoute()
        .prepare(async (req) => {
          executionOrder.push('prepare')
          return { prepared: true }
        })
        .parse({
          body: async (ctx) => {
            executionOrder.push('parse')
            return { parsed: true }
          }
        })
        .handle(async (req, ctx) => {
          executionOrder.push('handle')
          return {
            success: true,
            context: ctx
          }
        })

      const result = await route.invoke({
        customData: 'override',
        // @ts-expect-error body.custom is not valid payload
        parsed: { body: { custom: 'data' } }
      })

      expect(executionOrder).toEqual(['handle']) // Only handle called
      expect(result.success).toBe(true)
    })
  })

  describe("Framework Response Helpers", () => {
    test("route handler returns user response directly", async () => {
      const route = createRoute()
        .prepare(async (req) => ({ prepared: true }))
        .handle(async (req, ctx) => {
          return {
            message: 'Hello World',
            prepared: ctx.prepared
          }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)

      // Should return JSON directly, not wrapped in Response
      expect(result).toEqual({
        message: 'Hello World',
        prepared: true
      })
    })

    test("route handler preserves user Response objects", async () => {
      const route = createRoute()
        .handle(async (req, ctx) => {
          // User returns Response directly for full control
          return new Response(JSON.stringify({ custom: 'response' }), {
            status: 201,
            headers: {
              'Content-Type': 'application/json',
              'X-Custom': 'user-controlled'
            }
          }) as unknown as { custom: string }
        })

      const mockRequest = new Request('http://localhost/test')
      const result = await route(mockRequest)

      // Should return the Response object as-is
      expect(result).toBeInstanceOf(Response)
    })

    test("invoke method returns JSON as-is", async () => {
      const route = createRoute()
        .prepare(async (req) => ({ prepared: true }))
        .handle(async (req, ctx) => {
          return {
            message: 'Hello from invoke',
            prepared: ctx.prepared
          }
        })

      const result = await route.invoke()

      // invoke should return the JSON directly
      expect(result).toEqual({
        message: 'Hello from invoke',
        prepared: true
      })
    })

    test("error handling throws RouteError for proper framework handling", async () => {
      const route = createRoute()
        .prepare(async (req) => {
          throw new RouteError("Preparation failed", {
            errorCode: 'PREP_ERROR',
            errorMessage: 'Something went wrong during preparation',
            httpStatus: 422
          })
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/error')

      await expect(route(mockRequest)).rejects.toThrow(RouteError)
      await expect(route(mockRequest)).rejects.toMatchObject({
        errorCode: 'PREP_ERROR',
        httpStatus: 422
      })
    })

    test("error handling throws for unexpected errors", async () => {
      const route = createRoute()
        .handle(async (req, ctx) => {
          throw new Error("Unexpected error")
        })

      const mockRequest = new Request('http://localhost/unexpected')

      await expect(route(mockRequest)).rejects.toThrow("Unexpected error")
    })
  })

  describe("Enhanced Error Handling", () => {
    test("framework request mapping errors are properly handled", async () => {
      const route = createRoute({
        requestObject: (args) => {
          const context = args as Record<string, unknown>
          if (context?.req) {
            return context.req as Request
          }
          throw new Error('Invalid Hono context object')
        }
      })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      // Pass invalid object that doesn't match Hono context
      const invalidContext = { notReq: 'invalid' }

      await expect(route(invalidContext)).rejects.toThrow(RouteError)
      await expect(route(invalidContext)).rejects.toMatchObject({
        errorCode: 'REQUEST_MAPPING_ERROR',
        httpStatus: 400
      })
    })

    test("basic error handling with onError hook", async () => {
      let capturedError: Error | null = null

      const route = createRoute({
        onError: async (error) => {
          capturedError = error
        }
      })
        .prepare(async (req) => {
          throw new RouteError("Custom error", {
            errorCode: 'CUSTOM_ERROR',
            errorMessage: 'This is a custom error',
            httpStatus: 418 // I'm a teapot
          })
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      const mockRequest = new Request('http://localhost/error')

      try {
        await route(mockRequest)
      } catch (error) {
        // Expected to throw
      }

      expect(capturedError).toBeInstanceOf(RouteError)
      expect((capturedError as unknown as RouteError).errorCode).toBe('CUSTOM_ERROR')
    })

    test("invoke method error handling", async () => {
      let errorCaught = false

      const route = createRoute({
        onError: async (err) => {
          errorCaught = true
        }
      })
        .prepare(async (req) => {
          throw new Error("Prepare error in invoke")
        })
        .handle(async (req, ctx) => {
          return { success: true }
        })

      expect(route.invoke()).rejects.toThrow(
        new RouteError('Internal Server Error: Error in prepare step', {
          errorCode: 'INTERNAL_SERVER_ERROR',
          errorMessage: 'Error in prepare step',
          httpStatus: 500
        })
      )

      expect(errorCaught).toBe(true)
    })
  })

  describe("Real Framework Integration Examples", () => {
    test("Next.js API route pattern", async () => {
      // Simulate Next.js API route: export default async function handler(req, context)
      const nextjsRoute = createRoute({
        requestObject: (args) => (Array.isArray(args) ? args : [args])[0] as Request
      })
        .prepare(async (req, ctx) => {
          // Extract user from session/headers
          const authHeader = req.headers.get('authorization')
          return {
            user: authHeader ? { id: 'user-123', token: authHeader } : null
          }
        })
        .parse({
          body: async (ctx) => {
            // Parse and validate request body
            return { name: (ctx.body as { name: string }).name, email: (ctx.body as { email: string }).email }
          },
          method: 'POST'
        })
        .handle(async (req, ctx) => {
          if (!ctx.user) {
            throw new RouteError("Unauthorized", {
              errorCode: 'UNAUTHORIZED',
              errorMessage: 'Authentication required',
              httpStatus: 401
            })
          }

          return {
            success: true,
            user: ctx.user,
            data: ctx.parsed.body
          }
        })

      const mockNextRequest = new Request('http://localhost:3000/api/users', {
        method: 'POST',
        headers: {
          'authorization': 'Bearer nextjs-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' })
      })

      const result = await nextjsRoute(mockNextRequest)

      expect(result.success).toBe(true)
      expect(result.user.token).toBe('Bearer nextjs-token')
      expect(result.data).toEqual({ name: 'John', email: 'john@example.com' })
    })

    test("Cloudflare Workers pattern", async () => {
      // Simulate: export default { async fetch(request, env, ctx) { ... } }
      const cfRoute = createRoute({
        requestObject: (args) => (Array.isArray(args) ? args : [args])[0] as Request
      })
        .prepare(async (req, ctx) => {
          return {
            edge: true,
            region: 'us-east-1' // Could be extracted from cf-ray header
          }
        })
        .parse({
          query: async (ctx) => {
            return {
              limit: Number.parseInt(ctx.query.limit || '10'),
              offset: Number.parseInt(ctx.query.offset || '0')
            }
          }
        })
        .handle(async (req, ctx) => {
          return {
            success: true,
            edge: ctx.edge,
            region: ctx.region,
            pagination: ctx.parsed.query
          }
        })

      const mockCfRequest = new Request('http://worker.example.com/api/data?limit=5&offset=10')
      const mockEnv = { DB_URL: 'sqlite://db.sqlite' }
      const mockCtx = { waitUntil: () => { } }

      const result = await cfRoute(mockCfRequest, mockEnv, mockCtx)

      expect(result).toEqual({
        success: true,
        edge: true,
        region: 'us-east-1',
        pagination: { limit: 5, offset: 10 }
      })
    })

    test("Express.js middleware pattern", async () => {
      // Simulate: app.post('/api/users', routeHandler)
      const expressRoute = createRoute({
        requestObject: (args) => {
          const req = (Array.isArray(args) ? args : [args])[0] as Record<string, unknown>

          if (req?.method && req.url) {
            const url = req.protocol ? `${req.protocol}://api.example.com${req.originalUrl || req.url}`
              : `http://api.example.com${req.originalUrl || req.url}`
            return new Request(url, {
              method: req.method as string,
              headers: new Headers(req.headers as Record<string, string> || {}),
              body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify(req.body) : undefined
            })
          }

          throw new Error('Invalid Express request object')
        }
      })
        .prepare(async (req, ctx) => {
          // Could access req.session, req.user, etc.
          return { middleware: 'express' }
        })
        .parse({
          body: async (ctx) => {
            // Body parsing (typically done by express.json() middleware)
            return { validated: true, data: ctx.body }
          }
        })
        .handle(async (req, ctx) => {
          return {
            message: 'Express route handled',
            middleware: ctx.middleware,
            body: ctx.parsed.body
          }
        })

      // Mock Express request object
      const mockExpressReq = {
        method: 'POST',
        url: '/api/users',
        protocol: 'https',
        headers: { 'content-type': 'application/json' },
        body: { name: 'Express User' },
        originalUrl: '/api/users'
      }

      const result = await expressRoute(mockExpressReq)

      expect(result).toEqual({
        message: 'Express route handled',
        middleware: 'express',
        body: { validated: true, data: { name: 'Express User' } }
      })
    })
  })
})

describe("Stage 10: Route Type Extraction", () => {
  describe("Route Type Extraction", () => {
    test("inferRouteType extracts basic route information", () => {
      const route = createRoute()
        .parse({
          method: 'POST',
          path: '/api/users' as const
        })
        .handle(async (req, ctx) => {
          return {
            success: true,
            message: 'User created'
          }
        })

      // Type-level test - this validates TypeScript compilation
      type RouteType = typeof route.inferRouteType
      type TestTypePath = Expect<Eq<RouteType['path'], '/api/users'>>
      type TestTypePathParams = Expect<Eq<RouteType['pathParams'], {}>>
      type TestTypeMethod = Expect<Eq<RouteType['method'], 'POST'>>
      type TestTypeInput = Expect<Eq<RouteType['input'], { body: undefined, query: undefined }>>
      type TestTypeReturnValue = Expect<Eq<RouteType['returnValue'], { success: boolean, message: string }>>

      // Runtime validation that the property exists
      expect(route.inferRouteType).toBeDefined()
      expect(typeof route.inferRouteType).toBe('object')

      const route2 = createRoute()
        .parse({
          method: 'GET',
          path: '/api/users/[id]' as const,
          body: async (ctx) => {
            return {
              name: ctx.body.name as string,
              email: ctx.body.email as string
            }
          }
        })
        .handle(async (req, ctx) => {
          return {}
        })

      type RouteType2 = typeof route2.inferRouteType
      type TestTypePath2 = Expect<Eq<RouteType2['path'], '/api/users/[id]'>>
      type TestTypePathParams2 = Expect<Eq<RouteType2['pathParams'], { id: string }>>
      type TestTypeMethod2 = Expect<Eq<RouteType2['method'], 'GET'>>
      type TestTypeInput2 = Expect<Eq<RouteType2['input'], { body: { name: string, email: string }, query: undefined }>>
      type TestTypeReturnValue2 = Expect<Eq<RouteType2['returnValue'], {}>>
    })

    test("inferRouteType extracts input types from body and query", () => {
      const route = createRoute()
        .parse({
          body: async (ctx) => {
            const body = ctx.body as { name: string, email: string };
            return { name: body.name, email: body.email }
          },
          query: async (ctx) => {
            return {
              page: Number.parseInt(ctx.query.page || '1'),
              limit: Number.parseInt(ctx.query.limit || '10')
            }
          },
          method: 'POST'
        })
        .handle(async (req, ctx) => {
          return {
            user: ctx.parsed.body,
            pagination: ctx.parsed.query
          }
        })

      type RouteType = typeof route.inferRouteType

      // Validate that input types are properly extracted
      const typeTest: RouteType = {
        path: 'any-string' as string,
        method: 'POST' as const,
        pathParams: {},
        input: {
          body: { name: 'test', email: 'test@example.com' },
          query: { page: 1, limit: 10 }
        },
        returnValue: {
          user: { name: 'test', email: 'test@example.com' },
          pagination: { page: 1, limit: 10 }
        }
      }

      expect(route.inferRouteType).toBeDefined()
    })

    test("inferRouteType handles routes without parse fields", () => {
      const route = createRoute()
        .prepare(async (req) => ({ timestamp: Date.now() }))
        .handle(async (req, ctx) => {
          return {
            message: 'Simple route',
            timestamp: ctx.timestamp
          }
        })

      type RouteType = typeof route.inferRouteType

      // When no parse fields are defined, defaults should apply
      const typeTest: RouteType = {
        path: 'any-string' as string,
        method: 'any-method' as string,
        pathParams: {},
        input: { body: undefined, query: undefined },
        returnValue: { message: 'Simple route', timestamp: 12345 }
      }

      expect(route.inferRouteType).toBeDefined()
    })

    test("inferRouteType works with complex nested types", () => {
      const route = createRoute()
        .parse({
          body: async (ctx) => {
            const data = ctx.body as {
              user: { name: string, profile: { age: number } },
              preferences: string[]
            }
            return data
          },
          query: async (ctx) => {
            return {
              include: ctx.query.include?.split(',') || [],
              sort: ctx.query.sort || 'name'
            }
          },
          method: ['GET', 'POST'] as const,
          path: '/api/users/[id]'
        })
        .handle(async (req, ctx) => {
          return {
            data: ctx.parsed.body,
            meta: {
              query: ctx.parsed.query,
              method: ctx.parsed.method,
              path: ctx.parsed.path
            }
          }
        })

      type RouteType = typeof route.inferRouteType

      // Validate complex nested type extraction
      const typeTest: RouteType['input'] = {
        body: {
          user: { name: 'John', profile: { age: 30 } },
          preferences: ['dark-mode', 'notifications']
        },
        query: {
          include: ['profile', 'preferences'],
          sort: 'name'
        }
      }

      expect(route.inferRouteType).toBeDefined()
    })

    test("inferRouteType enables type-safe client generation patterns", () => {
      // This demonstrates how the extracted types could be used for client generation
      const userCreateRoute = createRoute()
        .parse({
          body: async (ctx) => {
            const data = ctx.body as { name: string, email: string, age?: number }
            return data
          },
          method: 'POST',
          path: '/api/users'
        })
        .handle(async (req, ctx) => {
          return {
            id: 'user-123',
            ...ctx.parsed.body,
            createdAt: new Date().toISOString()
          }
        })

      const userListRoute = createRoute()
        .parse({
          query: async (ctx) => {
            return {
              page: Number.parseInt(ctx.query.page || '1'),
              search: ctx.query.search || ''
            }
          },
          method: 'GET',
          path: '/api/users/[id]'
        })
        .handle(async (req, ctx) => {
          return {
            users: [{ id: 'user-123', name: 'John', email: 'john@example.com' }],
            pagination: { page: ctx.parsed.query.page, total: 1 }
          }
        })

      // Extract types for client generation
      type CreateUserRoute = typeof userCreateRoute.inferRouteType
      type ListUsersRoute = typeof userListRoute.inferRouteType

      // These would be the types available for client-side usage
      type CreateUserInput = CreateUserRoute['input']['body']
      type CreateUserResponse = CreateUserRoute['returnValue']
      type ListUsersQuery = ListUsersRoute['input']['query']
      type ListUsersResponse = ListUsersRoute['returnValue']

      // Type validation
      const createInput: CreateUserInput = { name: 'John', email: 'john@example.com', age: 30 }
      const listQuery: ListUsersQuery = { page: 1, search: 'john' }

      expect(userCreateRoute.inferRouteType).toBeDefined()
      expect(userListRoute.inferRouteType).toBeDefined()
    })
  })
})
