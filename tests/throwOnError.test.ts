import { describe, expect, test } from "bun:test";
import { throwOnError } from '../src/shared/throwOnError';
import { AppError } from '../src/shared/error';

describe("throwOnError", () => {
  test("does not throw error for object without error property", () => {
    const obj = { error: undefined, data: "some data" };
    expect(() => {
      throwOnError(obj, "Operation failed");
    }).not.toThrow();
  });

  test("does not throw error for object with null error", () => {
    const obj = { error: null, data: "some data" };
    expect(() => {
      throwOnError(obj, "Operation failed");
    }).not.toThrow();
  });

  test("does not throw error for object with undefined error", () => {
    const obj = { error: undefined, data: "some data" };
    expect(() => {
      throwOnError(obj, "Operation failed");
    }).not.toThrow();
  });

  test("throws AppError for object with error string", () => {
    const obj = { error: "Something went wrong" };
    expect(() => {
      throwOnError(obj, "Operation failed");
    }).toThrow(AppError);

    try {
      throwOnError(obj, "Operation failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Operation failed");
      expect((error as AppError).cause).toBe("Something went wrong");
    }
  });

  test("throws AppError for object with error object", () => {
    const originalError = new Error("Original error");
    const obj = { error: originalError };
    expect(() => {
      throwOnError(obj, "Operation failed");
    }).toThrow(AppError);

    try {
      throwOnError(obj, "Operation failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Operation failed");
      expect((error as AppError).cause).toBe(originalError);
    }
  });

  test("throws AppError for function that throws", () => {
    const throwingFn = () => {
      throw new Error("Function error");
    };

    expect(() => {
      throwOnError(throwingFn, "Operation failed");
    }).toThrow(AppError);

    try {
      throwOnError(throwingFn, "Operation failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Operation failed");
      expect((error as Error & { cause: Error }).cause.message).toBe("Function error");
    }
  });

  test("returns function result when it doesn't throw", () => {
    const successFn = () => "success";
    const result = throwOnError(successFn, "Operation failed");
    expect(result).toBe("success");
  });

  test("allows custom error params", () => {
    const obj = { error: new Error("Original error") };
    
    expect(() => {
      throwOnError(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: 400,
        report: true
      });
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: 400,
        report: true
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Custom error");
      expect((error as AppError).errorCode).toBe("CUSTOM_ERROR_CODE");
      expect((error as AppError).httpStatus).toBe(400);
      expect((error as AppError).report).toBe(true);
    }
  });
});
