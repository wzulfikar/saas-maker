import { createRoute } from "../src/server/createRoute"

const PORT = process.env.PORT || 1234

/**
Usage:
bun examples/bun-serve.ts
*/

Bun.serve({
  port: 1234,
  routes: {
    "/": createRoute().handle(async (ctx) => {
      return new Response("Hello, world!")
    })
  },
})

console.log(`Server is running...`)
