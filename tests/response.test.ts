import { describe, expect, test } from "bun:test";
import {
  json,
  text,
  redirect,
  emptyResponse,
  stream,
  badRequest,
  notFound,
  notAuthenticated,
  forbidden,
  internalServerError
} from "../src/server/response";

describe("Response helpers", () => {
  test("json() creates a valid JSON response", () => {
    const data = { foo: "bar" };
    const response = json(data);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Type")).toContain("application/json");
    
    // Check response body
    return response.json().then(body => {
      expect(body).toEqual(data);
    });
  });

  test("json() with custom status and headers", () => {
    const data = { message: "Created" };
    const response = json(data, { 
      status: 201,
      headers: { "X-Custom-Header": "test" } 
    });
    
    expect(response.status).toBe(201);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  test("text() creates a valid text response", () => {
    const textContent = "Hello, world!";
    const response = text(textContent);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    
    // Check response body
    return response.text().then(body => {
      expect(body).toBe(textContent);
    });
  });

  test("text() with custom status and headers", () => {
    const response = text("Not Found", { 
      status: 404,
      headers: { "X-Custom-Header": "test" } 
    });
    
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("text/plain");
    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  test("redirect() creates a redirect response", () => {
    const url = "https://example.com";
    const response = redirect(url);
    
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(url);
  });

  test("redirect() with custom status and headers", () => {
    const url = "https://example.com";
    const response = redirect(url, 301, { 
      headers: { "X-Custom-Header": "test" } 
    });
    
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(url);
    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  test("emptyResponse() creates a 204 No Content response", () => {
    const response = emptyResponse();
    
    expect(response.status).toBe(204);
    
    // Check body is empty
    return response.text().then(body => {
      expect(body).toBe("");
    });
  });

  test("emptyResponse() with custom headers", () => {
    const response = emptyResponse({ 
      headers: { "X-Custom-Header": "test" } 
    });
    
    expect(response.status).toBe(204);
    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  test("stream() creates a streaming response", () => {
    // Create a sample readable stream
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: hello\n\n"));
        controller.close();
      }
    });
    
    const response = stream(readable);
    
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  test("stream() with custom status and headers", () => {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("data: hello\n\n"));
        controller.close();
      }
    });
    
    const response = stream(readable, { 
      status: 202,
      headers: { "X-Custom-Header": "test" } 
    });
    
    expect(response.status).toBe(202);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("X-Custom-Header")).toBe("test");
  });

  test("badRequest() creates a 400 Bad Request response", () => {
    const response = badRequest();
    
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    
    // Check response body
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code: "BAD_REQUEST",
          message: "Bad Request"
        }
      });
    });
  });

  test("badRequest() with custom message and code", () => {
    const message = "Invalid input";
    const code = "INVALID_INPUT";
    const response = badRequest(message, code);
    
    expect(response.status).toBe(400);
    
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code,
          message
        }
      });
    });
  });

  test("notFound() creates a 404 Not Found response", () => {
    const response = notFound();
    
    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Resource not found"
        }
      });
    });
  });

  test("notAuthenticated() creates a 401 Unauthenticated response", () => {
    const response = notAuthenticated();
    
    expect(response.status).toBe(401);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required"
        }
      });
    });
  });

  test("forbidden() creates a 403 Forbidden response", () => {
    const response = forbidden();
    
    expect(response.status).toBe(403);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code: "UNAUTHORIZED",
          message: "Access forbidden"
        }
      });
    });
  });

  test("internalServerError() creates a 500 Internal Server Error response", () => {
    const response = internalServerError();
    
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    
    return response.json().then(body => {
      expect(body).toEqual({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal Server Error"
        }
      });
    });
  });
});
