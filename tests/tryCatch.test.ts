import { describe, expect, test } from "bun:test";
import { tryCatch } from '../src/shared/tryCatch';
import fs from 'node:fs';

describe("tryCatch", () => {
  test("return data and null error on successful promise", async () => {
    const expectedData = { id: 1, name: "test" };
    const promise = Promise.resolve(expectedData);

    const result = await tryCatch(promise);

    expect(result.data).toEqual(expectedData);
    expect(result.error).toBeNull();
  });

  test("return null data and error on promise rejection", async () => {
    const expectedError = new Error("Something went wrong");
    const promise = Promise.reject(expectedError);

    const result = await tryCatch(promise);

    expect(result.data).toBeNull();
    expect(result.error).toBe(expectedError);
  });

  test("handle custom error types", async () => {
    class CustomError extends Error {
      code: string;

      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    }

    const expectedError = new CustomError("Custom error", "ERR_CUSTOM");
    const promise = Promise.reject(expectedError);

    const result = await tryCatch<unknown, CustomError>(promise);

    expect(result.data).toBeNull();
    expect(result.error).toBe(expectedError);
    expect(result.error?.code).toBe("ERR_CUSTOM");
  });

  test("async functions", async () => {
    const asyncFn = async () => {
      return "async function result";
    };

    const result = await tryCatch(asyncFn());

    expect(result.data).toBe("async function result");
    expect(result.error).toBeNull();
  });

  test("catch errors in async functions", async () => {
    const asyncFn = async () => {
      throw new Error("Async function error");
    };

    const result = await tryCatch(asyncFn());

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toBe("Async function error");
  });

  test("synchronous function", () => {
    const result = tryCatch(() => "success");
    expect(result.data).toBe("success");
    expect(result.error).toBeNull();

    const result2 = tryCatch(() => {
      throw new Error("error");
    });
    expect(result2.data).toBeNull();
    expect(result2.error).toBeInstanceOf(Error);
    expect(result2.error?.message).toBe("error");

    const result3 = tryCatch(() => {
      fs.readFileSync('/non-existent-file.txt');
    });
    expect(result3.data).toBeNull();
    expect(result3.error).toBeInstanceOf(Error);
    expect(result3.error?.message).toBe("ENOENT: no such file or directory, open '/non-existent-file.txt'");
  });
});
