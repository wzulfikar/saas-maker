import { createRoute, json } from "../src/server"

const PORT = process.env.PORT || 1234

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
