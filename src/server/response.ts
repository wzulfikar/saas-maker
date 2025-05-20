import type { ErrorInfo } from "../shared/error";
import type { ErrorCode } from "../types";

const JSON_HEADERS = { "Content-Type": "application/json" };

// Returns a JSON Response
export function json<T>(
  data: T,
  init: ResponseInit = {}
): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}

// Returns a plain text Response
export function text(
  body: string,
  init: ResponseInit = {}
): Response {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { "Content-Type": "text/plain", ...init.headers }
  });
}

// Returns a redirect Response
export function redirect(
  url: string,
  status: 301 | 302 = 302,
  init: ResponseInit = {}
): Response {
  return new Response(null, {
    status,
    headers: { Location: url, ...init.headers }
  });
}

// Returns an empty Response (204 No Content)
export function emptyResponse(
  init: ResponseInit = {}
): Response {
  return new Response(null, {
    status: 204,
    headers: init.headers
  });
}

// Returns a streaming Response for server-sent events
export function stream(
  stream: ReadableStream<Uint8Array>,
  init: ResponseInit = {}
): Response {
  return new Response(stream, {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...init.headers
    }
  });
}

// Returns a 400 Bad Request Response
export function badRequest(
  message = "Bad Request",
  code: ErrorCode = "BAD_REQUEST",
  init: ResponseInit = {}
): Response {
  return json({ error: { code, message } as ErrorInfo }, {
    status: 400,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}

// Returns a 404 Not Found Response
export function notFound(
  message = "Resource not found",
  code: ErrorCode = "RESOURCE_NOT_FOUND",
  init: ResponseInit = {}
): Response {
  return json({ error: { code, message } as ErrorInfo }, {
    status: 404,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}

// Returns a 401 Unauthenticated Response
export function notAuthenticated(
  message = "Authentication required",
  code: ErrorCode = "UNAUTHENTICATED",
  init: ResponseInit = {}
): Response {
  return json({ error: { code, message } as ErrorInfo }, {
    status: 401,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}

// Returns a 403 Unauthorized Response
export function forbidden(
  message = "Access forbidden",
  code: ErrorCode = "UNAUTHORIZED",
  init: ResponseInit = {}
): Response {
  return json({ error: { code, message } as ErrorInfo }, {
    status: 403,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}

// Returns a 500 Internal Server Error Response
export function internalServerError(
  message = "Internal Server Error",
  code: ErrorCode = "INTERNAL_SERVER_ERROR",
  init: ResponseInit = {}
): Response {
  return json({ error: { code, message } as ErrorInfo }, {
    status: 500,
    headers: { ...JSON_HEADERS, ...init.headers }
  });
}
