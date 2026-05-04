/**
 * Returns the base URL of the app from a request.
 * Priority:
 * 1. NEXT_PUBLIC_APP_URL env var (if set explicitly)
 * 2. host header from the request (works in both dev and prod)
 * 3. fallback to localhost
 */
export function getAppUrl(req: Request): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  const host = req.headers.get('host')
  if (host) {
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1')
    const protocol = isLocalhost ? 'http' : 'https'
    return `${protocol}://${host}`
  }

  return 'http://localhost:3000'
}
