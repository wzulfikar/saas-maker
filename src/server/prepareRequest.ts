import { json } from './response';

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
type PrepareRequestOpt<T = any> = (req: Request) => Promise<T>

type ParserFn<T, R = T> = (payload: T) => Promise<R>;

// Options type for PrepareRequest
type PrepareRequestOptions<
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TAuth = any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TExtra = any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  THeaders = any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TBody = any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TQuery = any,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  TForm = any
> = {
  authenticate?: PrepareRequestOpt<TAuth>;
  getCustomerId?: PrepareRequestOpt<{ customerId: string }>;
  getSubscriptionId?: PrepareRequestOpt<{ subscriptionId: string }>;
  parseHeaders?: ParserFn<Record<string, string>, THeaders>;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  parseBody?: ParserFn<any, TBody>;
  parseQuery?: ParserFn<Record<string, string>, TQuery>;
  parseForm?: ParserFn<FormData, TForm>;
  prepare?: PrepareRequestOpt<TExtra>;
  rateLimit?: PrepareRequestOpt<boolean>;
  cacheResponse?: PrepareRequestOpt;
  onError?: (error: unknown) => Promise<void>;
  onResponse?: (response: Response) => Promise<void>;
  logger?: {
    info: (message: string) => Promise<void>;
    error: (message: string) => Promise<void>;
  };
};

// Helper type to infer context from options
type InferContext<TOpts extends PrepareRequestOptions> = {
  headers: TOpts['parseHeaders'] extends ParserFn<Record<string, string>, infer H> ? H : Record<string, string>;
  body: TOpts['parseBody'] extends ParserFn<unknown, infer B> ? B : unknown;
  query: TOpts['parseQuery'] extends ParserFn<Record<string, string>, infer Q> ? Q : Record<string, string>;
  form: TOpts['parseForm'] extends ParserFn<FormData, infer F> ? F : FormData | null;
} &
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  (TOpts['authenticate'] extends PrepareRequestOpt<infer A> ? { auth: A } : {}) &
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  (TOpts['getCustomerId'] extends PrepareRequestOpt<{ customerId: string }> ? { customerId: string } : {}) &
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  (TOpts['getSubscriptionId'] extends PrepareRequestOpt<{ subscriptionId: string }> ? { subscriptionId: string } : {}) &
  // biome-ignore lint/complexity/noBannedTypes: <explanation>
  (TOpts['prepare'] extends PrepareRequestOpt<infer E> ? E : {});

// Type helper for creating structured API endpoint definitions
export type PreparedRequest<T extends {
  path: string;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  body?: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  query?: any;
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  result: any;
}> = {
  path: T['path'];
  body: T['body'];
  query: T['query'];
  result: InferHandlerReturn<T['result']>;
};

// Helper type to infer the return type from a handler function
type InferHandlerReturn<T> = T extends { _returnType?: infer R } ? R : never;

export class PrepareRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PrepareRequestError';
  }
}

export function prepareRequest<TOpts extends PrepareRequestOptions>(
  opts: TOpts
): {
  handle: <TReturn>(
    handler: (req: Request, context: InferContext<TOpts>) => Promise<TReturn>
  ) => ((req: Request) => Promise<Response>) & { _returnType?: TReturn }
} {
  const logger = opts.logger ?? {
    info: (message: string) => Promise.resolve(console.log(message)),
    error: (message: string) => Promise.resolve(console.error(message)),
  };

  // TODO: set up instance variables for current request 

  return {
    handle: (handler) => async (originalRequest: Request) => {
      try {
        const { req, ctx } = await prepare(originalRequest, opts)

        // Call the handler with all parsed data
        const result = await handler(req, ctx);

        // Convert object returns to JSON responses
        const response = result instanceof Response ? result : json(result);

        // Maybe we can integrate this with `waitUntil` helper if provided?

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
        }, { status: 500 });
      }
    }
  };
}

async function prepare<TOpts extends PrepareRequestOptions>(req: Request, opts: TOpts) {
  // Authentication
  let auth: unknown = undefined;
  if (opts.authenticate) {
    auth = await opts.authenticate(req);
  }

  // Parse headers
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const parsedHeaders = opts.parseHeaders ? await opts.parseHeaders(headers) : headers;

  // Parse query parameters
  const url = new URL(req.url);
  const queries = Object.fromEntries(url.searchParams.entries());
  const parsedQuery = opts.parseQuery ? await opts.parseQuery(queries) : queries;

  // Parse body based on content type
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
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
    if (isLimited) throw new PrepareRequestError('Rate limit exceeded');
  }

  // Prepare request and get extra context
  let extraContext = undefined;
  if (opts.prepare) {
    extraContext = await opts.prepare(req);
  }
  // Build context object based on provided options
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  const ctx: any = {
    headers: parsedHeaders,
    body: parsedBody,
    query: parsedQuery,
    form: opts.parseForm ? parsedBody as FormData : null,
  };

  // Only add fields if the corresponding options were provided
  if (opts.authenticate)
    ctx.auth = auth;
  if (opts.getCustomerId && customerId)
    ctx.customerId = customerId;
  if (opts.getSubscriptionId && subscriptionId)
    ctx.subscriptionId = subscriptionId;
  if (opts.prepare && extraContext)
    Object.assign(ctx, extraContext);

  return { req, ctx: ctx as InferContext<TOpts> }
}
