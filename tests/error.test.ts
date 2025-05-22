import { describe, expect, test } from "bun:test";
import { AppError, getErrorInfo } from "../src/shared/error";

// Uncomment to test custom/extend/extendStrict errors
// declare module "../src/types" {
//   interface ErrorCodes {
//     custom: "TEST_ERROR_CODE"
//   }
// }

describe("AppError", () => {
  test("create an error with basic message", () => {
    const error = new AppError("Test error message");
    
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.message).toBe("Test error message");
    expect(error.errorCode).toBeUndefined();
    expect(error.httpStatus).toBeUndefined();
    expect(error.report).toBeUndefined();
  });
  
  test("create an error with errorCode", () => {
    const error = new AppError("Test error with code", { 
      errorCode: "TEST_ERROR_CODE"
    });
    
    expect(error.message).toBe("Test error with code");
    expect(error.errorCode).toBe("TEST_ERROR_CODE");
  });
  
  test("create an error with httpStatus", () => {
    const error = new AppError("Not found error", { 
      errorCode: "NOT_FOUND",
      httpStatus: 404
    });
    
    expect(error.httpStatus).toBe(404);
  });
  
  test("create an error with cause", () => {
    const originalError = new Error("Original error");
    const error = new AppError("Wrapped error", { cause: originalError });
    
    expect(error.cause).toBe(originalError);
  });
  
  test("create an error with report flag", () => {
    const error = new AppError("Reportable error", { report: true });
    
    expect(error.report).toBe(true);
  });
  
  test("generates a pretty log message", () => {
    const error = new AppError("Test error", {
      errorCode: "TEST_CODE",
      httpStatus: 400,
      report: true
    });
    
    expect(error.prettyLog).toBe('[AppError] error: "Test error" | code: TEST_CODE | httpStatus: 400 | report: true');
  });
});

describe("getErrorInfo", () => {
  test("return null for non-AppError errors", () => {
    const regularError = new Error("Regular error");
    const errorInfo = getErrorInfo(regularError);
    
    expect(errorInfo).toBeNull();
  });
  
  test("return ErrorInfo for AppError", () => {
    const appError = new AppError("App error", {
      errorCode: "APP_ERROR",
      httpStatus: 500,
      report: true
    });
    
    const errorInfo = getErrorInfo(appError);
    
    expect(errorInfo).not.toBeNull();
    expect(errorInfo?.message).toBe("App error");
    expect(errorInfo?.code).toBe("APP_ERROR");
    expect(errorInfo?.httpStatus).toBe(500);
    expect(errorInfo?.report).toBe(true);
  });
});
