import { http } from "msw";
import { setupServer } from "msw/node";

type MSWResolver = Parameters<(typeof http)[keyof typeof http]>[1];

type MSWResolverArg = Parameters<MSWResolver>[0];

type SetupHooksArgs = {
  beforeAll: (cb: () => void) => void;
  beforeEach: (cb: () => void) => void;
  afterAll: (cb: () => void) => void;
};

export function createMsw() {
  const server = setupServer();

  const setupHooks = ({ beforeAll, beforeEach, afterAll }: SetupHooksArgs) => {
    beforeAll(() => server.listen());
    beforeEach(() => server.resetHandlers());
    afterAll(() => server.close());
  };

  const mockEndpoint = <T extends Response | object>(
    method: keyof typeof http,
    endpoint: string,
    resolverFn: (arg: MSWResolverArg) => T | Promise<T>,
  ) => {
    const mockState = {
      calls: [] as (MSWResolverArg & { result: T })[],
    };
    server.use(
      http[method](endpoint, async (arg) => {
        const result = await resolverFn(arg);
        mockState.calls.push({ ...arg, result });
        if (result instanceof Response) {
          return result;
        }
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    return mockState;
  };

  return { server, setupHooks, mockEndpoint };
}
