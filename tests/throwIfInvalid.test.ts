import { describe, expect, test } from "bun:test";
import { throwIfInvalid } from "../src/throwIfInvalid";
import { AppError } from "../src/error";

describe("throwIfInvalid", () => {
  test("does not throw error for valid non-empty string", () => {
    expect(() => {
      throwIfInvalid("valid string", "Value is invalid");
    }).not.toThrow();
  });
  
  test("does not throw error for valid number", () => {
    expect(() => {
      throwIfInvalid(42, "Value is invalid");
    }).not.toThrow();
  });
  
  test("does not throw error for valid object", () => {
    expect(() => {
      throwIfInvalid({ key: "value" }, "Value is invalid");
    }).not.toThrow();
  });
  
  test("does not throw error for non-empty array", () => {
    expect(() => {
      throwIfInvalid([1, 2, 3], "Value is invalid");
    }).not.toThrow();
  });
  
  test("throws AppError for null value", () => {
    expect(() => {
      throwIfInvalid(null, "Value is null");
    }).toThrow(AppError);
    
    try {
      throwIfInvalid(null, "Value is null");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Value is null");
      expect((error as AppError).errorCode).toBe("INVALID_STATE_ERROR");
    }
  });
  
  test("throws AppError for undefined value", () => {
    expect(() => {
      throwIfInvalid(undefined, "Value is undefined");
    }).toThrow(AppError);
    
    try {
      throwIfInvalid(undefined, "Value is undefined");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Value is undefined");
      expect((error as AppError).errorCode).toBe("INVALID_STATE_ERROR");
    }
  });
  
  test("throws AppError for empty string", () => {
    expect(() => {
      throwIfInvalid("", "Value is empty string");
    }).toThrow(AppError);
    
    try {
      throwIfInvalid("", "Value is empty string");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Value is empty string");
      expect((error as AppError).errorCode).toBe("INVALID_STATE_ERROR");
    }
  });
  
  test("throws AppError for empty array", () => {
    expect(() => {
      throwIfInvalid([], "Value is empty array");
    }).toThrow(AppError);
    
    try {
      throwIfInvalid([], "Value is empty array");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Value is empty array");
      expect((error as AppError).errorCode).toBe("INVALID_STATE_ERROR");
    }
  });
  
  test("allows custom error params", () => {
    expect(() => {
      throwIfInvalid(null, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "400",
        report: true
      });
    }).toThrow(AppError);
    
    try {
      throwIfInvalid(null, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "400",
        report: true
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Custom error");
      expect((error as AppError).errorCode).toBe("CUSTOM_ERROR_CODE");
      expect((error as AppError).httpStatus).toBe("400");
      expect((error as AppError).report).toBe(true);
    }
  });
});
