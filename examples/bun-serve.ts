import { z } from 'zod'
import { type } from 'arktype'
import { createRoute, json } from "../src/server"

const simpleHandler = createRoute().handle((ctx) => json({ ok: true }))

type SimpleRoute = typeof simpleHandler.inferRouteType

const routeWithMethodAndPathAndQuery = createRoute().parse({
  method: 'GET',
  path: '/api/users/[id]' as const,
  query: (ctx) => ({ name: 'john' })
}).handle((ctx) => ({ ok: true }))

type RouteWithMethodAndPath = typeof routeWithMethodAndPathAndQuery.inferRouteType

// Composable routes
const baseRoute = createRoute()

const parseWithZodOrArk = baseRoute
  .parse({
    body: (ctx) => z.object({
      name: z.string()
    }).parse(ctx.body),
    query: (ctx) => type({
      id: 'string'
    }).assert(ctx.query)
  })
  // Call parse multiple times
  .parse({
    resource: (ctx) => {
      // ...fetch related item
      return { item: ctx.parsed.query.id }
    }
  })
  .handle((ctx) => {
    ctx.parsed.body;
    ctx.parsed.query;
    return json({ parsed: ctx.parsed })
  })

// Routes with auth
const userRoute = baseRoute.parse({
  auth: (ctx) => {
    const id = ctx.authHeader?.split(' ')[1]
    if (!id) throw new Error("Not authenticated")
    return { userId: id }
  }
})

const usersComments = userRoute.parse({
  resource: (ctx) => ({
    comments: [] as string[]
  })
}).handle((ctx) => {
  const { auth, resource } = ctx.parsed
  return json({
    userId: auth.userId,
    comments: resource.comments
  })
})

/**
Usage:
bun --hot examples/bun-serve.ts
*/

Bun.serve({
  port: 1234,
  routes: {
    "/": simpleHandler,
    "/parse": parseWithZodOrArk,
    "/my-comments": usersComments
  },
})

console.log(`Server is running...`)
