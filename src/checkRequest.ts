import { json } from './response';

type CheckRequestOpt<T = any> = (req: Request) => Promise<T>

type ParserFn<T, R = T> = (payload: T) => Promise<R>;

// Basic context with just the required fields for all requests
type BaseContext = {
  headers: any;
  body: any;
  query: any;
  form: any | null;
};

// Options type for checkRequest
type CheckRequestOptions<
  TAuth = any,
  TExtra = any
> = {
  authenticate?: CheckRequestOpt<TAuth>;
  getCustomerId?: CheckRequestOpt<{ customerId: string }>;
  getSubscriptionId?: CheckRequestOpt<{ subscriptionId: string }>;
  parseHeaders?: ParserFn<Record<string, string>, any>;
  parseBody?: ParserFn<any, any>;
  parseQuery?: ParserFn<Record<string, string>, any>;
  parseForm?: ParserFn<FormData, any>;
  prepare?: CheckRequestOpt<TExtra>;
  rateLimit?: CheckRequestOpt<boolean>;
  cacheResponse?: CheckRequestOpt;
  onError?: (error: unknown) => Promise<void>;
  onResponse?: (response: Response) => Promise<void>;
  logger?: {
    info: (message: string) => Promise<void>;
    error: (message: string) => Promise<void>;
  };
};

// Helper type to infer context from options
type InferContext<TOpts extends CheckRequestOptions> = BaseContext &
  (TOpts['authenticate'] extends CheckRequestOpt<infer A> ? { auth: A } : {}) &
  (TOpts['getCustomerId'] extends CheckRequestOpt<{ customerId: string }> ? { customerId: string } : {}) &
  (TOpts['getSubscriptionId'] extends CheckRequestOpt<{ subscriptionId: string }> ? { subscriptionId: string } : {}) &
  (TOpts['prepare'] extends CheckRequestOpt<infer E> ? E : {});

export class CheckRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckRequestError';
  }
}

export function checkRequest<TOpts extends CheckRequestOptions>(
  opts: TOpts
): (
  handler: (req: Request, context: InferContext<TOpts>) => Promise<Response>
) => (req: Request) => Promise<Response> {
  const logger = opts.logger ?? {
    info: (message: string) => console.log(message),
    error: (message: string) => console.error(message),
  };

  return (handler) => async (req: Request) => {
    try {
      // Authentication
      let auth: any = undefined;
      if (opts.authenticate) {
        auth = await opts.authenticate(req);
      }

      // Parse headers
      const headers = Object.fromEntries(req.headers.entries());
      const parsedHeaders = opts.parseHeaders ? await opts.parseHeaders(headers) : headers;

      // Parse query parameters
      const url = new URL(req.url);
      const queries = Object.fromEntries(url.searchParams.entries());
      const parsedQuery = opts.parseQuery ? await opts.parseQuery(queries) : queries;

      // Parse body based on content type
      let parsedBody: any = null;
      const contentType = req.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const data = await req.json();
        parsedBody = opts.parseBody ? await opts.parseBody(data) : data;
      } else if (contentType?.includes('multipart/form-data')) {
        const formData = await req.formData();
        if (opts.parseForm) {
          parsedBody = await opts.parseForm(formData);
        } else {
          parsedBody = formData;
        }
      }

      // Get customer and subscription info if needed
      const customerId = opts.getCustomerId ? (await opts.getCustomerId(req)).customerId : undefined;
      const subscriptionId = opts.getSubscriptionId ? (await opts.getSubscriptionId(req)).subscriptionId : undefined;

      // Rate limiting
      if (opts.rateLimit) {
        const isLimited = await opts.rateLimit(req);
        if (isLimited) throw new CheckRequestError('Rate limit exceeded');
      }

      // Prepare request and get extra context
      let extraContext = undefined;
      if (opts.prepare) {
        extraContext = await opts.prepare(req);
      }

      // Build context object based on provided options
      const context: any = {
        headers: parsedHeaders,
        body: parsedBody,
        query: parsedQuery,
        form: opts.parseForm ? parsedBody : null,
      };

      // Only add fields if the corresponding options were provided
      if (opts.authenticate) {
        context.auth = auth;
      }

      if (opts.getCustomerId && customerId) {
        context.customerId = customerId;
      }

      if (opts.getSubscriptionId && subscriptionId) {
        context.subscriptionId = subscriptionId;
      }

      if (opts.prepare && extraContext) {
        Object.assign(context, extraContext);
      }

      // Call the handler with all parsed data
      const response = await handler(req, context as InferContext<TOpts>);

      await opts.onResponse?.(response).catch((e) => {
        logger.error(`Error in onResponse handler: ${e}`);
      });

      // Cache response if needed
      await opts.cacheResponse?.(req).catch((e) => {
        logger.error(`Error in cacheResponse handler: ${e}`);
      });

      return response;
    } catch (error: unknown) {
      // Handle other errors
      await opts.onError?.(error).catch((e) => {
        logger.error(`Error in onError handler: ${e}`);
      });

      logger.error(`Request processing error: ${error}`);
      return json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, { status: 500 })
    }
  };
}

// Example with required auth
type User = { userId: string; role: 'admin' | 'user' };

export const POST = checkRequest({
  authenticate: async (req: Request) => {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) throw new CheckRequestError('API key is required');
    return { userId: apiKey, role: 'user' as const };
  },
  prepare: async (req: Request) => ({
    startTime: Date.now(),
    requestId: crypto.randomUUID(),
    ip: req.headers.get('x-forwarded-for') || 'unknown'
  })
})(async (req, ctx) => {
  // ctx.auth is guaranteed to exist based on the options
  const { auth, startTime, requestId, ip } = ctx;
  const duration = Date.now() - startTime;

  return json({
    role: auth.role,
    metrics: { requestId, ip, duration }
  });
});

// Example with optional auth
export const GET = checkRequest({
  authenticate: async (req) => {
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) throw new CheckRequestError('API key is required');
    return { userId: apiKey, role: 'user' as const };
  }
})(async (req, ctx) => {
  // ctx.auth is guaranteed to exist but may be null
  if (!ctx.auth) {
    return json({ role: 'guest' });
  }
  return json({ role: ctx.auth.role });
});

// Example with no auth
export const PUBLIC_GET = checkRequest({
  // No auth option provided, so ctx.auth will not exist
})(async (req, ctx) => {
  // ctx should be just { headers, body, query, form }
  return json({ message: 'Public endpoint' });
});
