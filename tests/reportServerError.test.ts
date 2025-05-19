import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { reportServerError } from '../src/server/reportServerError';
import type { SeverityLevel } from '../src/types';

// Mock Sentry
const mockCaptureException = mock(() => {});
const mockFlush = mock(() => Promise.resolve());

mock.module('@sentry/node', () => ({
  captureException: mockCaptureException,
  flush: mockFlush,
}));

describe('reportServerError', () => {
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;
  const mockConsoleError = mock(() => {});
  const mockConsoleLog = mock(() => {});
  
  beforeEach(() => {
    console.error = mockConsoleError;
    console.log = mockConsoleLog;
    mockCaptureException.mockClear();
    mockFlush.mockClear();
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear();
    
    // Reset reporters before each test
    reportServerError.reporter = undefined;
    reportServerError.customReporter = undefined;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  test('use logger by default when no reporter is set', () => {
    const error = new Error('Test error');
    reportServerError(error);
    
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
    expect(mockConsoleError).toHaveBeenCalledWith(
      `[saas-maker] logError called: '${error}'. params: undefined`
    );
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  test('use Sentry when configured with full params', async () => {
    reportServerError.reporter = 'sentry';
    
    const error = new Error('Test error');
    const params = {
      ctx: '/test',
      level: 'error' as SeverityLevel,
      userId: 'test-user',
    };

    await reportServerError(error, params);
    
    // Wait for the dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error, {
      extra: { context: params.ctx },
      level: params.level,
      user: { id: params.userId },
    });
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  test('use Sentry with minimal params', async () => {
    reportServerError.reporter = 'sentry';
    
    const error = new Error('Test error');
    await reportServerError(error);
    
    // Wait for the dynamic import to resolve
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    expect(mockCaptureException).toHaveBeenCalledWith(error, {});
    expect(mockFlush).toHaveBeenCalledTimes(1);
  });

  describe('customReporter', () => {
    test('use customReporter when provided', async () => {
      const mockCustomReporter = mock(() => Promise.resolve());
      reportServerError.customReporter = mockCustomReporter;
      
      const error = new Error('Test error');
      const params = {
        ctx: '/test',
        level: 'error' as SeverityLevel,
        userId: 'test-user',
      };

      await reportServerError(error, params);
      
      expect(mockCustomReporter).toHaveBeenCalledTimes(1);
      expect(mockCustomReporter).toHaveBeenCalledWith(error, params);
      // Should not use default reporters when customReporter is set
      expect(mockCaptureException).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('customReporter takes precedence over reporter setting', async () => {
      const mockCustomReporter = mock(() => Promise.resolve());
      reportServerError.customReporter = mockCustomReporter;
      reportServerError.reporter = 'sentry';
      
      const error = new Error('Test error');
      await reportServerError(error);
      
      expect(mockCustomReporter).toHaveBeenCalledTimes(1);
      expect(mockCustomReporter).toHaveBeenCalledWith(error, undefined);
      // Should not use Sentry even though it's configured
      expect(mockCaptureException).not.toHaveBeenCalled();
    });
  });
});
