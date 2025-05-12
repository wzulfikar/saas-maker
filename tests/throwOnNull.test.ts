import { describe, expect, test } from "bun:test";
import { throwOnNull } from "../src/throwOnNull";
import { AppError } from "../src/error";

describe("throwOnNull", () => {
  test("does not throw error when data is present", () => {
    const obj = { data: { id: 1, name: "test" }, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data not found");
    }).not.toThrow();
  });
  
  test("throws AppError when data is falsy (0)", () => {
    const obj = { data: 0, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data not found");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Data not found");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Data not found");
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
  });
  
  test("throws AppError when data is falsy (empty string)", () => {
    const obj = { data: "", error: null };
    
    expect(() => {
      throwOnNull(obj, "Data not found");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Data not found");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Data not found");
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
  });
  
  test("throws AppError when data is falsy (false)", () => {
    const obj = { data: false, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data not found");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Data not found");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Data not found");
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
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
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
  });
  
  test("throws AppError when data is undefined", () => {
    const obj = { data: undefined, error: null };
    
    expect(() => {
      throwOnNull(obj, "Data is undefined");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Data is undefined");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Data is undefined");
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
  });
  
  test("throws AppError when error is present", () => {
    const obj = { data: { id: 1 }, error: new Error("Something went wrong") };
    
    expect(() => {
      throwOnNull(obj, "Error detected");
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Error detected");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Error detected");
      expect((error as AppError).errorCode).toBe("DATA_NOT_FOUND_ERROR");
    }
  });
  
  test("allows custom error params", () => {
    const obj = { data: null, error: null };
    
    expect(() => {
      throwOnNull(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "404",
        report: true
      });
    }).toThrow(AppError);
    
    try {
      throwOnNull(obj, "Custom error", {
        errorCode: "CUSTOM_ERROR_CODE",
        httpStatus: "404",
        report: true
      });
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).message).toBe("Custom error");
      expect((error as AppError).errorCode).toBe("CUSTOM_ERROR_CODE");
      expect((error as AppError).httpStatus).toBe("404");
      expect((error as AppError).report).toBe(true);
    }
  });
});
