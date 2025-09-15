import { describe, expect, test } from "bun:test";
import { unwrapData } from '../src/shared/unwrapData';
import { AppError } from "../src/shared/error";
import type { Result } from "../src/types";

describe("unwrapData", () => {
  test("no error", () => {
    const result: Result<{ ok: true }> = { data: { ok: true }, error: null };
    unwrapData(result, "test");
    expect(result.data).toEqual({ ok: true });
  });

  test("has error", () => {
    const result: Result<{ ok: true }> = { data: null, error: new Error("test") };
    try {
      unwrapData(result, "Some data");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Error getting some data");
    }
  });

  test("has null data", () => {
    const result: Result<{ ok: true }, null> = { data: null, error: null };
    try {
      unwrapData(result, "Some data");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Some data not found");
    }
  });
});
