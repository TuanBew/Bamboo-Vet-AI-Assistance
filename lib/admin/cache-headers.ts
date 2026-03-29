import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'crypto'

// ---------------------------------------------------------------------------
// HTTP Caching Helpers for Admin API Routes
// ---------------------------------------------------------------------------

/**
 * Default max-age for admin API responses (1 hour).
 * Admin dashboard data changes infrequently — once per materialized view refresh.
 */
const DEFAULT_MAX_AGE = 3600 // 1 hour in seconds

/**
 * Generate a weak ETag from JSON response body.
 * Uses MD5 hash of the stringified data for fast comparison.
 */
function generateETag(data: unknown): string {
  const hash = createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
    .substring(0, 16)
  return `W/"${hash}"`
}

/**
 * Create a NextResponse with Cache-Control and ETag headers.
 *
 * If the client sends If-None-Match matching the ETag, returns 304 Not Modified.
 * Otherwise returns the full JSON response with caching headers.
 *
 * @param request - The incoming NextRequest (to read If-None-Match)
 * @param data - The response payload to serialize as JSON
 * @param maxAge - Cache-Control max-age in seconds (default: 1 hour)
 */
export function jsonWithCache(
  request: NextRequest,
  data: unknown,
  maxAge: number = DEFAULT_MAX_AGE
): NextResponse {
  const etag = generateETag(data)

  // Check If-None-Match for conditional request
  const ifNoneMatch = request.headers.get('if-none-match')
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        'ETag': etag,
        'Cache-Control': `private, max-age=${maxAge}, stale-while-revalidate=${Math.floor(maxAge / 2)}`,
      },
    })
  }

  // Full response with caching headers
  return NextResponse.json(data, {
    headers: {
      'ETag': etag,
      'Cache-Control': `private, max-age=${maxAge}, stale-while-revalidate=${Math.floor(maxAge / 2)}`,
    },
  })
}
