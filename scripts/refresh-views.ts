/**
 * Refresh all 4 admin dashboard materialized views.
 *
 * Calls the refresh_admin_views() Postgres function (created in migration 006)
 * which internally runs:
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_queries;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_queries;
 *   REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_stats;
 *   REFRESH MATERIALIZED VIEW mv_dashboard_kpis;  (plain, no CONCURRENTLY)
 *
 * Usage: npx ts-node scripts/refresh-views.ts
 */

import { createClient } from '@supabase/supabase-js'
import { fileURLToPath } from 'url'
import path from 'path'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function main() {
  console.log('Refreshing admin dashboard materialized views...')
  const start = Date.now()

  const { error } = await supabase.rpc('refresh_admin_views')

  if (error) {
    console.error('FAILED:', error.message)
    process.exit(1)
  }

  const elapsed = Date.now() - start
  console.log(`All 4 views refreshed successfully (${elapsed}ms)`)
}

main()
