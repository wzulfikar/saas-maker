import { createRoute, json } from "../src/server"

/**
Usage:
bun --hot examples/bun-serve.ts
*/

Bun.serve({
  port: 1234,
  routes: {
    "/": createRoute().handle(async (ctx) => {
      return json({ ok: false })
    })
  },
})

console.log(`Server is running...`)
