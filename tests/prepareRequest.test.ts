import { describe, expect, test } from "bun:test";
import { z } from "zod";
import { prepareRequest, PrepareRequestError, type PreparedRequest } from "../src/server/prepareRequest";

describe("preparedRequest", () => {
  describe("Logic Tests", () => {
    test("handle basic request without options", async () => {
      const route = prepareRequest({}).handle(async (req, ctx) => {
        return { message: "success" };
      });

      const req = new Request("http://localhost/test");
      const response = await route(req);

      expect(response).toBeInstanceOf(Response);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toEqual({ message: "success" });
    });

    test("handle authentication", async () => {
      const route = prepareRequest({
        authenticate: async (req) => {
          const auth = req.headers.get("Authorization");
          if (!auth) throw new PrepareRequestError("Unauthorized");
          return auth;
        },
      }).handle(async (req, ctx) => {
        return { userId: ctx.auth };
      });

      // Test with auth header
      const reqWithAuth = new Request("http://localhost/test", {
        headers: { Authorization: "Bearer token123" },
      });
      const response = await route(reqWithAuth);
      const data = await response.json();
      expect(data).toEqual({ userId: "Bearer token123" });

      // Test without auth header - should return error
      const reqWithoutAuth = new Request("http://localhost/test");
      const errorResponse = await route(reqWithoutAuth);
      expect(errorResponse.status).toBe(500);
    });

    test("parse JSON body", async () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      const route = prepareRequest({
        parseBody: schema.parseAsync,
      }).handle(async (req, ctx) => {
        return { received: ctx.body };
      });

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "John", age: 30 }),
      });

      const response = await route(req);
      const data = await response.json();
      expect(data.received).toEqual({ name: "John", age: 30 });
    });

    test("parse query parameters", async () => {
      const querySchema = z.object({
        page: z.string(),
        limit: z.string(),
      });

      const route = prepareRequest({
        parseQuery: querySchema.parseAsync,
      }).handle(async (req, ctx) => {
        return { query: ctx.query };
      });

      const req = new Request("http://localhost/test?page=1&limit=10");
      const response = await route(req);
      const data = await response.json();
      expect(data.query).toEqual({ page: "1", limit: "10" });
    });

    test("handle custom preparation", async () => {
      const route = prepareRequest({
        prepare: async (req) => {
          return { customData: "prepared" };
        },
      }).handle(async (req, ctx) => {
        return { custom: ctx.customData };
      });

      const req = new Request("http://localhost/test");
      const response = await route(req);
      const data = await response.json();
      expect(data.custom).toBe("prepared");
    });

    test("handle Response objects directly", async () => {
      const route = prepareRequest({}).handle(async (req, ctx) => {
        return new Response("Custom response", { status: 201 });
      });

      const req = new Request("http://localhost/test");
      const response = await route(req);

      expect(response.status).toBe(201);
      expect(await response.text()).toBe("Custom response");
    });

    test("handle errors in parsing", async () => {
      const schema = z.object({
        name: z.string(),
      });

      const route = prepareRequest({
        parseBody: schema.parseAsync,
      }).handle(async (req, ctx) => {
        return { success: true };
      });

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invalidField: "value" }),
      });

      const response = await route(req);
      expect(response.status).toBe(500);
    });
  });

  describe("Type Tests", () => {
    test("PreparedRequest should structure endpoint types correctly", () => {
      const userSchema = z.object({
        name: z.string(),
        email: z.string(),
      });

      const querySchema = z.object({
        id: z.string(),
      });

      const route = prepareRequest({
        parseBody: userSchema.parseAsync,
        parseQuery: querySchema.parseAsync,
      }).handle(async (req, ctx) => {
        return {
          user: ctx.body,
          userId: ctx.query.id,
        };
      });

      type Endpoint = PreparedRequest<{
        path: "/api/users/:id";
        body: z.infer<typeof userSchema>;
        query: z.infer<typeof querySchema>;
        result: typeof route;
      }>;

      // Type structure verification
      const _: Endpoint = {
        path: "/api/users/123",
        body: { name: "John", email: "john@example.com" },
        query: { id: "123" },
        result: {
          user: { name: "John", email: "john@example.com" },
          userId: "123",
        },
      };
    });

    test("infer context types from parsers", async () => {
      const bodySchema = z.object({ username: z.string() });
      const querySchema = z.object({ page: z.string() });

      const route = prepareRequest({
        authenticate: async (req) => {
          const auth = req.headers.get("Authorization");
          return auth || "no-auth";
        },
        parseBody: bodySchema.parseAsync,
        parseQuery: querySchema.parseAsync,
      }).handle(async (req, ctx) => {
        // These should be properly typed
        const username: string = ctx.body.username;
        const page: string = ctx.query.page;
        const auth: string = ctx.auth;

        return {
          username,
          page,
          auth,
        };
      });

      const req = new Request("http://localhost/test?page=1", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "Authorization": "Bearer token",
        },
        body: JSON.stringify({ username: "testuser" }),
      });

      const response = await route(req);
      const data = await response.json();

      expect(data).toEqual({
        username: "testuser",
        page: "1",
        auth: "Bearer token",
      });
    });

    test("PreparedRequest with optional fields", () => {
      const route = prepareRequest({}).handle(async (req, ctx) => {
        return { status: "ok" };
      });

      // Query-only endpoint
      type GetEndpoint = PreparedRequest<{
        path: "/api/status";
        query: { detailed: string };
        result: typeof route;
      }>;

      // Body-only endpoint  
      type PostEndpoint = PreparedRequest<{
        path: "/api/create";
        body: { name: string };
        result: typeof route;
      }>;

      // No query or body
      type SimpleEndpoint = PreparedRequest<{
        path: "/api/ping";
        result: typeof route;
      }>;

      // Type checks
      const getEndpoint: GetEndpoint = {
        path: "/api/status",
        query: { detailed: "true" },
        body: undefined,
        result: { status: "ok" },
      };

      const postEndpoint: PostEndpoint = {
        path: "/api/create",
        body: { name: "test" },
        query: undefined,
        result: { status: "ok" },
      };

      const simpleEndpoint: SimpleEndpoint = {
        path: "/api/ping",
        body: undefined,
        query: undefined,
        result: { status: "ok" },
      };

      expect(getEndpoint.path).toBe("/api/status");
      expect(postEndpoint.path).toBe("/api/create");
      expect(simpleEndpoint.path).toBe("/api/ping");
    });

    test("automatic path pattern matching", () => {
      const userHandler = prepareRequest({
        parseQuery: z.object({ id: z.string() }).parseAsync,
      }).handle(async (req, ctx) => {
        return {
          userId: ctx.query.id,
          name: "Test User",
        };
      });

      // Path with parameters - should accept any string
      type UserEndpoint = PreparedRequest<{
        path: "/api/users/:id";
        query: { id: string };
        result: typeof userHandler;
      }>;

      // All of these should work automatically
      const templatePath: UserEndpoint["path"] = "/api/users/:id";
      const actualPath1: UserEndpoint["path"] = "/api/users/123";
      const actualPath2: UserEndpoint["path"] = "/api/users/abc";
      const actualPath3: UserEndpoint["path"] = "/api/users/user-456";
      
      expect(templatePath).toBe("/api/users/:id");
      expect(actualPath1).toBe("/api/users/123");
      expect(actualPath2).toBe("/api/users/abc");
      expect(actualPath3).toBe("/api/users/user-456");

      // Path without parameters - should only accept exact match
      type ExactEndpoint = PreparedRequest<{
        path: "/api/health";
        result: typeof userHandler;
      }>;

      const exactPath: ExactEndpoint["path"] = "/api/health"; // ✅ Should work
      // const invalidPath: ExactEndpoint["path"] = "/api/status"; // ❌ Should cause TypeScript error
      
      expect(exactPath).toBe("/api/health");
    });
  });

  describe("Edge Cases", () => {
    test("handle multipart form data", async () => {
      const route = prepareRequest({
        parseForm: async (formData) => {
          const data: Record<string, string> = {};
          formData.forEach((value, key) => {
            data[key] = value.toString();
          });
          return data;
        },
      }).handle(async (req, ctx) => {
        return { formData: ctx.form };
      });

      const formData = new FormData();
      formData.append("name", "John");
      formData.append("email", "john@example.com");

      const req = new Request("http://localhost/test", {
        method: "POST",
        body: formData,
      });

      const response = await route(req);
      const data = await response.json();
      expect(data.formData).toEqual({
        name: "John",
        email: "john@example.com",
      });
    });

    test("handle rate limiting", async () => {
      let requestCount = 0;
      const route = prepareRequest({
        rateLimit: async (req) => {
          requestCount++;
          return requestCount > 2; // Allow first 2 requests, then rate limit
        },
      }).handle(async (req, ctx) => {
        return { message: "success" };
      });

      const req = new Request("http://localhost/test");

      // First request should succeed
      const response1 = await route(req);
      expect(response1.status).toBe(200);

      // Second request should succeed
      const response2 = await route(req);
      expect(response2.status).toBe(200);

      // Third request should be rate limited
      const response3 = await route(req);
      expect(response3.status).toBe(500);
    });

    test("handle error callbacks", async () => {
      let errorCaught = false;

      const route = prepareRequest({
        parseBody: async (body) => {
          throw new Error("Parsing failed");
        },
        onError: async (error) => {
          errorCaught = true;
        },
      }).handle(async (req, ctx) => {
        return { success: true };
      });

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      });

      const response = await route(req);
      expect(response.status).toBe(500);
      expect(errorCaught).toBe(true);
    });

    test("handle custom logger", async () => {
      const logs: string[] = [];

      const route = prepareRequest({
        logger: {
          info: async (message) => { logs.push(`INFO: ${message}`); },
          error: async (message) => { logs.push(`ERROR: ${message}`); },
        },
        parseBody: async (body) => {
          throw new Error("Test error");
        },
      }).handle(async (req, ctx) => {
        return { success: true };
      });

      const req = new Request("http://localhost/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ test: "data" }),
      });

      await route(req);

      expect(logs.some(log => log.includes("ERROR"))).toBe(true);
    });

    test("handle customer and subscription IDs", async () => {
      const route = prepareRequest({
        getCustomerId: async (req) => ({ customerId: "customer123" }),
        getSubscriptionId: async (req) => ({ subscriptionId: "sub456" }),
      }).handle(async (req, ctx) => {
        return {
          customerId: ctx.customerId,
          subscriptionId: ctx.subscriptionId,
        };
      });

      const req = new Request("http://localhost/test");
      const response = await route(req);
      const data = await response.json();

      expect(data).toEqual({
        customerId: "customer123",
        subscriptionId: "sub456",
      });
    });
  });
});
