import { describe, test, expect } from 'bun:test'
import { flags } from '../src'

// Define the flag IDs used in tests
type TestFlagId = 
  | 'feature-a' 
  | 'feature-b' 
  | 'feature-c' 
  | 'server-flag' 
  | 'server-flag-2' 
  | 'nonexistent' 
  | 'hello';

describe('flags', () => {
  test('return false for can() with undefined flag', async () => {
    flags.flags = {}
    flags.userId = undefined
    flags.fetchFlag = undefined
    
    const result = await flags.can('hello')
    expect(result).toBe(false)
  })

  test('return true for can() with enabled flag', async () => {
    flags.flags = { 'feature-a': { enabled: true } }
    flags.userId = undefined
    flags.fetchFlag = undefined
    
    const result = await flags.can('feature-a')
    expect(result).toBe(true)
  })

  test('return false for can() with disabled flag', async () => {
    flags.flags = { 'feature-b': { enabled: false } }
    flags.userId = undefined
    flags.fetchFlag = undefined
    
    const result = await flags.can('feature-b')
    expect(result).toBe(false)
  })

  test('return the flag for get() with existing flag', async () => {
    const testFlag = { enabled: true, data: { name: 'test' } as Record<string, unknown> }
    flags.flags = { 'feature-c': testFlag }
    flags.userId = undefined
    flags.fetchFlag = undefined
    
    const result = await flags.get('feature-c')
    expect(result).toEqual(testFlag)
  })

  test('return the default value for get() with undefined flag', async () => {
    flags.flags = {}
    flags.userId = undefined
    flags.fetchFlag = undefined
    
    const defaultFlag = { enabled: false, data: { test: true } as Record<string, unknown> }
    const result = await flags.get('nonexistent', defaultFlag)
    expect(result).toEqual(defaultFlag)
  })

  test('fetch flag from server when flag is not found locally', async () => {
    flags.flags = {}
    flags.userId = 'user123'
    
    const serverFlag = { enabled: true, data: { source: 'server' } as Record<string, unknown> }
    flags.fetchFlag = async (flagId, userId) => {
      expect(flagId).toBe('server-flag')
      expect(userId).toBe('user123')
      return serverFlag
    }

    const result = await flags.get('server-flag')
    expect(result).toEqual(serverFlag)
  })

  test('store fetched flag in flags object', async () => {
    flags.flags = {}
    flags.userId = undefined
    
    const serverFlag = { enabled: true, data: { source: 'server' } as Record<string, unknown> }
    flags.fetchFlag = async () => serverFlag
    
    await flags.get('server-flag-2')
    expect(flags.flags?.['server-flag-2']).toEqual(serverFlag)
  })

  test('typed flag ids can be used for type checking', () => {
    function typedFunction(flagId: TestFlagId) {
      return flagId;
    }
    
    // This should compile without errors
    typedFunction('feature-a');
    typedFunction('hello');
    
    // This would cause a TypeScript error:
    // typedFunction('invalid-id');
    
    expect(true).toBe(true);
  })
})
