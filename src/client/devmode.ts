const DEVMODE_KEY = 'devmode'

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let _devmode: Record<string, any> = {}

try {
  _devmode =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem(DEVMODE_KEY) ?? '{}')
      : {}
} catch (e) {
  console.error(`Error parsing 'devmode' from localStorage. error: ${e}`)
}

/**
 * Get value from `devmode` in localStorage. You'll need to
 * reload the page after changing a value from localStorage.
 */
export const devmode = {
  get: <T>(
    key: string,
    defaultValue?: T,
  ): T extends infer U ? U : never => _devmode?.[key] ?? defaultValue,
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  set: (key: string, value: any) => {
    _devmode[key] = value
    localStorage.setItem(DEVMODE_KEY, JSON.stringify(_devmode))
  }
}
