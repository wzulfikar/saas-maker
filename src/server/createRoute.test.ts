import { describe, it } from "bun:test"
import { createRoute } from "./createRoute"

describe("createRoute", () => {
  it("create a route", () => {
    const route = createRoute({
      onRequest: async (req) => {},
      onResponse: async (res) => {},
      onError: async (err) => {},
    })
  })
})
