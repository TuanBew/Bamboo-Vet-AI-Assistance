// Kills any process holding the MCP server port before startup.
// Runs as npm prestart hook. No dependencies required.
const { execSync } = require('child_process')
const PORT = process.env.MCP_PORT || '3100'

try {
  if (process.platform === 'win32') {
    const out = execSync('netstat -ano', { encoding: 'utf8' })
    for (const line of out.split('\n')) {
      if (line.includes(`:${PORT} `) && line.includes('LISTENING')) {
        const pid = line.trim().split(/\s+/).pop()
        if (pid && pid !== '0') {
          try {
            execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' })
            console.log(`[prestart] Released port ${PORT} (killed PID ${pid})`)
          } catch { /* already gone */ }
        }
      }
    }
  } else {
    execSync(`lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true`, { shell: true, stdio: 'ignore' })
  }
} catch { /* port was free, nothing to do */ }
