import { describe, test, expect } from 'bun:test'
import { flags } from '../src/packages/flags'

// Uncomment this to add type for flagId param
// declare module '../src/types.ts' {
//   interface Flags {
//     id: 'feature-a'
//   }
// }

describe('flags', () => {
  test('return false for can() with undefined flag', async () => {
    flags.flags = {}
    flags.userId = undefined
    flags.fetchFlag = undefined

    const result = flags.enabled('feature-a')
    expect(result).toBe(false)
  })

  test('return true for can() with enabled flag', async () => {
    flags.flags = { 'feature-a': { enabled: true } }
    flags.userId = undefined
    flags.fetchFlag = undefined

    const result = flags.enabled('feature-a')
    expect(result).toBe(true)
  })

  test('return false for can() with disabled flag', async () => {
    flags.flags = { 'feature-b': { enabled: false } }
    flags.userId = undefined
    flags.fetchFlag = undefined

    const result = flags.enabled('feature-b')
    expect(result).toBe(false)
  })

  test('return the flag for get() with existing flag', async () => {
    const testFlag = { enabled: true, data: { name: 'test' } as Record<string, unknown> }
    flags.flags = { 'feature-c': testFlag }
    flags.userId = undefined
    flags.fetchFlag = undefined

    const result = flags.get('feature-c')
    expect(result).toEqual(testFlag)
  })

  test('return the default value for get() with undefined flag', async () => {
    flags.flags = {}
    flags.userId = undefined
    flags.fetchFlag = undefined

    const defaultFlag = { enabled: false, data: { test: true } as Record<string, unknown> }
    const result = flags.get('nonexistent', defaultFlag)
    expect(result).toEqual(defaultFlag)
  })

  test('return false when flag is not found', async () => {
    flags.flags = {}
    expect(flags.get('server-flag')).toBeUndefined()
    expect(flags.enabled('server-flag')).toEqual(false)
  })

  test('store fetched flags in flags object', async () => {
    flags.flags = {}
    flags.userId = undefined

    const serverFlag = { enabled: true, data: { source: 'server' } as Record<string, unknown> }
    flags.fetchFlag = async () => serverFlag

    const flag = await flags.fetch('server-flag-2')
    expect(flag).toEqual(serverFlag)
    expect(flags.get('server-flag-2')).toEqual(serverFlag)
  })
})
