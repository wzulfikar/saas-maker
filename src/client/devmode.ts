// biome-ignore lint/suspicious/noExplicitAny: <explanation>
let _devmode: Record<string, any> = {}

try {
  _devmode =
    typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('devmode') ?? '{}')
      : {}
} catch (e) {
  console.error(`Error parsing 'devmode' from localStorage. error: ${e}`)
}

/**
 * Get value from `devmode` in localStorage. You'll need to
 * reload the page after changing a value from localStorage.
 */
export const devmode = <T>(
  key: string,
  defaultValue?: T,
): T extends infer U ? U : never => _devmode?.[key] ?? defaultValue
