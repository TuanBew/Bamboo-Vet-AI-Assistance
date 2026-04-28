# start-tunnel.ps1 — Start MCP server + Cloudflare tunnel together
# Usage: .\start-tunnel.ps1
# Stop: Ctrl+C in both windows, or close them

$mcpDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$mcpPort = 3100

# 1. Kill any leftover MCP server on the port
$existing = Get-NetTCPConnection -LocalPort $mcpPort -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($existing) {
    Write-Host "[MCP] Stopping existing process on port $mcpPort (PID $existing)..."
    Stop-Process -Id $existing -Force -ErrorAction SilentlyContinue
    Start-Sleep 1
}

# 2. Start MCP server in a new window
Write-Host "[MCP] Starting MCP server on port $mcpPort..."
$mcpWindow = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$mcpDir'; npm start" -PassThru -WindowStyle Normal
Start-Sleep 3

# 3. Verify MCP server is up
$up = Get-NetTCPConnection -LocalPort $mcpPort -ErrorAction SilentlyContinue
if (-not $up) {
    Write-Error "[MCP] Server failed to start on port $mcpPort. Check the MCP window for errors."
    exit 1
}
Write-Host "[MCP] Server running (PID $($mcpWindow.Id))" -ForegroundColor Green

# 4. Start Cloudflare tunnel in a new window
Write-Host "[CF]  Starting Cloudflare tunnel -> http://localhost:$mcpPort"
Write-Host "[CF]  Watch the new window for your tunnel URL (trycloudflare.com)"
Write-Host ""
Write-Host "EXPECTED log lines (all normal, not errors):" -ForegroundColor Yellow
Write-Host "  ERR Cannot determine default origin certificate path  <- HARMLESS, ignore" -ForegroundColor DarkYellow
Write-Host "  INF cloudflared does not support loading the system root certificate pool  <- HARMLESS" -ForegroundColor DarkYellow
Write-Host "  INF Registered tunnel connection ... protocol=http2  <- THIS MEANS IT WORKED" -ForegroundColor Green
Write-Host ""
Start-Process cloudflared -ArgumentList "tunnel --url http://localhost:$mcpPort" -WindowStyle Normal

Write-Host "[CF]  Tunnel window opened. Copy the https://*.trycloudflare.com URL from it." -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop everything: close both windows, or run Stop-Process -Name cloudflared,node" -ForegroundColor Gray
