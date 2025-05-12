import { describe, expect, test } from "bun:test";
import { throwOnError } from "../src/throwOnError";
import { AppError } from "../src/error";

describe("throwOnError", () => {
  test("does not throw when error is null", () => {
    const obj = { error: null, data: "test" };
    
    expect(() => {
      throwOnError(obj, "Error found");
    }).not.toThrow();
  });
  
  test("does not throw when error is undefined", () => {
    const obj = { error: undefined, data: "test" };
    
    expect(() => {
      throwOnError(obj, "Error found");
    }).not.toThrow();
  });
  
  test("throws AppError when error is an Error object", () => {
    const originalError = new Error("Original error");
    const obj = { error: originalError };
    
    expect(() => {
      throwOnError(obj, "Error message");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "Error message");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Error message");
      expect((error as AppError).cause).toBe(originalError);
    }
  });
  
  test("throws AppError when error is a string", () => {
    const obj = { error: "Error string" };
    
    expect(() => {
      throwOnError(obj, "Custom message");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "Custom message");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Custom message");
      expect((error as AppError).cause).toBe("Error string");
    }
  });
  
  test("throws AppError with error message when no custom message provided", () => {
    const originalError = new Error("Original error message");
    const obj = { error: originalError };
    
    expect(() => {
      throwOnError(obj, "");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Original error message");
      expect((error as AppError).cause).toBe(originalError);
    }
  });
  
  test("throws AppError with string error when no custom message provided", () => {
    const obj = { error: "String error message" };
    
    expect(() => {
      throwOnError(obj, "");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("String error message");
      expect((error as AppError).cause).toBe("String error message");
    }
  });
  
  test("throws AppError with object containing message property", () => {
    const obj = { error: { message: "Object message property" } };
    
    expect(() => {
      throwOnError(obj, "");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Object message property");
      expect((error as AppError).cause).toEqual({ message: "Object message property" });
    }
  });
  
  test("throws AppError with 'Unknown error' for other object types", () => {
    const obj = { error: { code: 500 } };
    
    expect(() => {
      throwOnError(obj, "");
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Unknown error");
      expect((error as AppError).cause).toEqual({ code: 500 });
    }
  });
  
  test("allows custom error params", () => {
    const originalError = new Error("Original error");
    const obj = { error: originalError };
    
    expect(() => {
      throwOnError(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "500",
        report: true
      });
    }).toThrow(AppError);
    
    try {
      throwOnError(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "500",
        report: true
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Custom error");
      expect((error as AppError).cause).toBe(originalError);
      expect((error as AppError).errorCode).toBe("CUSTOM_ERROR_CODE");
      expect((error as AppError).httpStatus).toBe("500");
      expect((error as AppError).report).toBe(true);
    }
  });

  // New tests for the function callback behavior
  test("returns value when function doesn't throw", () => {
    const value = throwOnError(() => "success", "Function failed");
    expect(value).toBe("success");
  });

  test("returns complex value when function doesn't throw", () => {
    const data = { id: 1, name: "test" };
    const result = throwOnError(() => data, "Function failed");
    expect(result).toEqual(data);
  });

  test("throws AppError when function throws", () => {
    expect(() => {
      throwOnError(() => {
        throw new Error("Function error");
      }, "Function failed");
    }).toThrow(AppError);

    try {
      throwOnError(() => {
        throw new Error("Function error");
      }, "Function failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Function failed");
      expect((error as AppError).cause).toBeInstanceOf(Error);
      expect(((error as AppError).cause as Error).message).toBe("Function error");
    }
  });

  test("can be used with validation functions", () => {
    // Mock schema validation
    const mockValidate = (data: any) => {
      if (typeof data !== "string") {
        throw new Error("Expected string");
      }
      return data.toUpperCase();
    };

    // Valid case
    const validResult = throwOnError(() => mockValidate("hello"), "Validation failed");
    expect(validResult).toBe("HELLO");

    // Invalid case
    expect(() => {
      throwOnError(() => mockValidate(123), "Validation failed");
    }).toThrow(AppError);

    try {
      throwOnError(() => mockValidate(123), "Validation failed");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Validation failed");
      expect(((error as AppError).cause as Error).message).toBe("Expected string");
    }
  });

  test("allows custom error params with function callbacks", () => {
    expect(() => {
      throwOnError(
        () => { throw new Error("Original error"); },
        "Function failed",
        {
          errorCode: "FUNCTION_ERROR",
          httpStatus: "400",
          report: true
        }
      );
    }).toThrow(AppError);

    try {
      throwOnError(
        () => { throw new Error("Original error"); },
        "Function failed",
        {
          errorCode: "FUNCTION_ERROR",
          httpStatus: "400",
          report: true
        }
      );
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Function failed");
      expect((error as AppError).errorCode).toBe("FUNCTION_ERROR");
      expect((error as AppError).httpStatus).toBe("400");
      expect((error as AppError).report).toBe(true);
    }
  });
});
