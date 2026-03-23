import type { ZodError } from "zod";
import {
  createRoute,
  jsonError,
  type ErrorHandlerPayload,
} from "../src/server";
import { getErrorInfo } from "../src/shared/error";
import { throwIfNull } from "../src/shared/throwIfNull";

const baseRoute = createRoute({
  name: "baseRoute",
  onError: handleError,
});

export const publicRoute = baseRoute.extend({ name: "publicRoute" });

export const userRoute = baseRoute.extend({ name: "userRoute" }).parse({
  auth: async () => {
    // @ts-ignore your getUser function
    const user = await getUser();
    throwIfNull(user, "Not authenticated", {
      errorCode: "ERROR_NOT_AUTHENTICATED",
      httpStatus: 401,
    });
    return { user };
  },
});

async function handleError(ctx: ErrorHandlerPayload) {
  const errorInfo = getErrorInfo(ctx.error.cause) || getErrorInfo(ctx.error);
  const errorCode = errorInfo?.code || "INTERNAL_SERVER_ERROR";
  const routeName = ctx.error.routeInfo?.name;

  // Return early without reporting if it's parsing error
  if (ctx.error.name === "RouteError" && ctx.error.cause?.name === "ZodError") {
    const code = "BAD_REQUEST";
    const msg = ctx.error.message;
    const details = ctx.error.cause as ZodError;
    console.warn(`[warn] [${code}] ${msg}: ${JSON.stringify(details)}`);
    return jsonError({ code, message: msg });
  }

  console.error(
    `[error] [${errorCode}] error when executing route '${routeName}': ${ctx.error}`,
  );
  console.log(
    "[error] route steps:",
    ctx.error.routeInfo?.steps || "(no steps)",
  );
  console.log("[error] cause:", ctx.error.cause || "(cause not set)");

  // Default error response
  return Response.json(
    { error: { code: errorCode, message: "Internal server error" } },
    { status: 500 },
  );
}
