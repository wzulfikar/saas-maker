import { describe, expect, test } from "bun:test";
import { throwOnNull } from '../src/shared/throwOnNull';
import { AppError } from '../src/shared/error';

describe("throwOnNull", () => {
  test("does not throw error when data is present", () => {
    const obj = { data: { id: 1, name: "test" }, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data not found");
    }).not.toThrow();
  });
  
  test("throws AppError when data is null", () => {
    const obj = { data: null, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data is null");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Data is null");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Data is null");
      expect((error as AppError).errorCode).toBe("UNEXPECTED_NULL_RESULT");
    }
  });
  
  test("allows custom error params", () => {
    const obj = { data: null };
    
    expect(() => {
      throwOnNull(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: 400,
        report: true
      });
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Custom error", {
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
