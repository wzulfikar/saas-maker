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
