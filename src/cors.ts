/**
 * Handles CORS for API routes. Example:
 *
 * ```ts
 * export const OPTIONS = cors()
 *
 * export async function POST(request: Request) {
 *   const corsResponse = await cors()(request)
 *   if (corsResponse) return corsResponse
 *
 *   // Process the request...
 * }
 * ```
 */
export function cors(opts?: { allowOrigin?: string; allowMethods?: string[] }) {
  return async (request: Request) => {
    const allowOrigin =
      request.headers.get('origin') || opts?.allowOrigin || '*'
    const allowMethods = opts?.allowMethods || [
      'GET',
      'POST',
      'PUT',
      'DELETE',
      'OPTIONS',
    ]
    if (request.method === 'OPTIONS') {
      const headers: Record<string, string> = {
        'Access-Control-Allow-Origin': allowOrigin,
        'Access-Control-Allow-Methods': allowMethods.join(', '),
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
      return new Response(null, { headers, status: 204 })
    }
    return null // Indicates that CORS is handled and request can proceed
  }
}
