# start-tunnel.ps1 — Start MCP server + ngrok tunnel together
# Usage: .\start-tunnel.ps1

$mcpDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mcpPort = 3100

# 1. Kill any leftover MCP server on the port
$existing = Get-NetTCPConnection -LocalPort $mcpPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($existing) {
    Write-Host "[MCP] Stopping existing process on port $mcpPort (PID $existing)..."
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

# 2. Kill any leftover ngrok process
Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

# 3. Start MCP server in a new window
Write-Host "[MCP] Starting MCP server on port $mcpPort..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mcpDir'; npm start" -WindowStyle Normal
Start-Sleep 5

# 4. Verify MCP server is up
$up = Get-NetTCPConnection -LocalPort $mcpPort -ErrorAction SilentlyContinue
if (-not $up) {
    Write-Error "[MCP] Server failed to start on port $mcpPort. Check the MCP window for errors."
    exit 1
}
Write-Host "[MCP] Server running." -ForegroundColor Green

# 5. Start ngrok tunnel
Write-Host "[ngrok] Starting tunnel on port $mcpPort..."
$ngrok = Start-Process -FilePath "ngrok" -ArgumentList "http", "$mcpPort" -PassThru -WindowStyle Normal
Start-Sleep 4

# 6. Get the public URL from ngrok's local API
$tunnelUrl = $null
for ($i = 0; $i -lt 5; $i++) {
    try {
        $resp = Invoke-RestMethod -Uri "http://localhost:4040/api/tunnels" -ErrorAction Stop
        $tunnelUrl = ($resp.tunnels | Where-Object { $_.proto -eq "https" } | Select-Object -First 1).public_url
        if ($tunnelUrl) { break }
    } catch { }
    Start-Sleep 2
}

if ($tunnelUrl) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host "  TUNNEL ACTIVE" -ForegroundColor Green
    Write-Host "============================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Public URL: $tunnelUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Update .env.local:" -ForegroundColor Yellow
    Write-Host "    MCP_SERVER_URL=$tunnelUrl" -ForegroundColor White
    Write-Host ""
    Write-Host "  Then restart the Next.js dev server (Ctrl+C then npm run dev)." -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ngrok] Could not auto-detect URL. Check the ngrok window." -ForegroundColor Yellow
    Write-Host "[ngrok] Or visit http://localhost:4040 in your browser." -ForegroundColor Gray
}
