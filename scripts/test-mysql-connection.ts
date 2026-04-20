import mysql from 'mysql2/promise'

async function main() {
  const host = process.env.MYSQL_HOST
  if (!host) {
    console.error('MYSQL_HOST not set. Add MySQL vars to .env.local')
    process.exit(1)
  }

  console.log(`Connecting to ${host}:${process.env.MYSQL_PORT ?? 3306}...`)

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT ?? 3306),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    connectTimeout: 10_000,
    ssl: process.env.MYSQL_SSL === 'true'
      ? { rejectUnauthorized: true }
      : undefined,
  })

  try {
    // 1. Basic connectivity
    const [ping] = await conn.execute('SELECT 1 AS ok')
    console.log('1. SELECT 1:', (ping as Array<{ ok: number }>)[0]?.ok === 1 ? 'OK' : 'FAIL')

    // 2. Privilege verification
    const [grants] = await conn.execute('SHOW GRANTS FOR CURRENT_USER()')
    console.log('2. GRANTS:')
    for (const row of grants as Array<Record<string, string>>) {
      const grant = Object.values(row)[0]
      console.log('   ', grant)
      if (/INSERT|UPDATE|DELETE|DROP|ALTER|CREATE/i.test(grant) && !/GRANT.*SELECT/i.test(grant)) {
        console.error('   WRITE GRANTS DETECTED — STOP IMMEDIATELY')
        process.exit(1)
      }
    }

    // 3. Table discovery
    const [tables] = await conn.execute('SHOW TABLES')
    const tableNames = (tables as Array<Record<string, string>>).map(r => Object.values(r)[0])
    console.log(`3. Tables (${tableNames.length} total):`)
    const expected = ['door', 'dpur', 'product', 'mv_dashboard_kpis']
    for (const t of expected) {
      const found = tableNames.includes(t)
      const altName = '_dp' + t.slice(1)
      const altFound = tableNames.includes(altName)
      if (found) {
        console.log(`   ${t}: FOUND`)
      } else if (altFound) {
        console.log(`   ${t}: NOT FOUND — but ${altName} EXISTS (use this name)`)
      } else {
        console.log(`   ${t}: NOT FOUND`)
      }
    }

    // 4. Column inventory
    for (const t of ['door', 'dpur', 'product']) {
      const tableName = tableNames.includes(t) ? t : tableNames.find(n => n.includes(t.replace('d', '')))
      if (tableName) {
        const [cols] = await conn.execute(`DESCRIBE \`${tableName}\``)
        const colNames = (cols as Array<{ Field: string }>).map(c => c.Field)
        console.log(`4. ${tableName} columns (${colNames.length}): ${colNames.join(', ')}`)
      }
    }

    // 5. Test a CALL statement
    try {
      const [spResult] = await conn.execute('CALL dashboard_npp_list()')
      const firstSet = Array.isArray(spResult) && Array.isArray(spResult[0]) ? spResult[0] : spResult
      console.log(`5. CALL dashboard_npp_list(): ${Array.isArray(firstSet) ? firstSet.length : 0} rows`)
      if (Array.isArray(firstSet) && firstSet.length > 0) {
        console.log('   First row:', JSON.stringify(firstSet[0]).slice(0, 200))
      }
    } catch (err) {
      console.log(`5. CALL dashboard_npp_list(): ERROR — ${(err as Error).message}`)
    }

    console.log('\nConnection test complete.')
  } finally {
    await conn.end()
  }
}

main().catch(err => {
  console.error('Connection failed:', err.message)
  if (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT')) {
    console.error('Your IP may not be whitelisted on the MySQL server.')
    console.error('Share your public IP with the senior engineer to get access.')
  }
  process.exit(1)
})
