#Requires -Version 5.1
<#
.SYNOPSIS
    Bamboo Vet AI - pre-flight checks + Native Build + Docker deployment

.DESCRIPTION
    Runs 4 pre-flight checks, builds Next.js natively to save RAM,
    then deploys the pre-built artifacts with docker compose.
    Safe to run repeatedly (idempotent). Fails fast with copy-paste fixes.

    HTTPS is handled by Cloudflare Tunnel - no inbound ports required.
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExitCode = 0

# -----------------------------------------------------------------------------
# Output helpers
# -----------------------------------------------------------------------------
$script:Warnings = [System.Collections.Generic.List[string]]::new()
$script:Failed   = [System.Collections.Generic.List[string]]::new()

function Write-Pass { param([string]$msg) Write-Host "  [PASS] $msg" -ForegroundColor Green }
function Write-Warn {
    param([string]$msg)
    $script:Warnings.Add($msg) | Out-Null
    Write-Host "  [WARN] $msg" -ForegroundColor Yellow
}
function Write-Fail {
    param([string]$msg, [string]$Fix = '')
    $script:Failed.Add($msg) | Out-Null
    Write-Host "`n  [FAIL] $msg" -ForegroundColor Red
    if ($Fix) { Write-Host "         FIX : $Fix" -ForegroundColor Cyan }
}
function Write-Section { param([string]$title) Write-Host "`n--- $title ---" -ForegroundColor White }
function Write-Hr      { Write-Host ("-" * 60) -ForegroundColor DarkGray }

function Stop-OnFailures {
    Write-Host "`n" -NoNewline
    Write-Hr
    Write-Host "  PRE-FLIGHT FAILED - fix the items above then re-run .\deploy.ps1" -ForegroundColor Red
    Write-Hr
    exit 1
}

# -----------------------------------------------------------------------------
# Header
# -----------------------------------------------------------------------------
Write-Hr
Write-Host "  Bamboo Vet AI - Deployment Pre-Flight" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  |  $env:COMPUTERNAME" -ForegroundColor DarkGray
Write-Hr

# -----------------------------------------------------------------------------
# 1. Docker Compose v2 & Node.js
# -----------------------------------------------------------------------------
Write-Section "1/4  Dependencies Check"

try {
    $verOutput = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
    $verString = (($verOutput -join '') | Select-String '\d+\.\d+\.\d+').Matches[0].Value
    $major = [int]($verString -split '\.')[0]
    if ($major -ge 2) {
        Write-Pass "Docker Compose $verString"
    } else {
        Write-Fail "Docker Compose $verString is too old (need v2+)" `
            "Update Docker Desktop to 4.x or later"
    }
} catch {
    Write-Fail "docker compose not found" "Install Docker Desktop"
}

# Check Node.js for native build
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Write-Pass "Node.js (npm) is installed for native build"
} else {
    Write-Fail "npm not found on system" "Install Node.js to enable RAM-saving native builds"
}

if ($script:Failed.Count -gt 0) { Stop-OnFailures }

# -----------------------------------------------------------------------------
# 2. Parse .env
# -----------------------------------------------------------------------------
Write-Section "2/4  .env validation"

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    Write-Fail ".env not found at $envFile" `
        "Run: copy .env.example .env  then fill in all values"
    Stop-OnFailures
}

$env = @{}
Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#') -and $line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
        $val = $Matches[2] -replace '\s+#.*$', ''
        $env[$Matches[1]] = $val.Trim()
    }
}

$placeholders = @('your_', 'your-', '<your', 'REPLACE_WITH_', '_here', '_key_here', '_token_here')
$requiredVars = @(
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RAGFLOW_API_KEY',
    'RAGFLOW_CHAT_ID',
    'RAGFLOW_BASE_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'GEMINI_API_KEY',
    'MCP_SERVER_URL',
    'MCP_JWT_SECRET',
    'MCP_CHAT_ID',
    'MYSQL_HOST',
    'MYSQL_PORT',
    'MYSQL_DATABASE',
    'MYSQL_USER',
    'MYSQL_PASSWORD',
    'CLOUDFLARE_TUNNEL_TOKEN',
    'PRODUCTION_DOMAIN'
)

foreach ($v in $requiredVars) {
    if (-not $env.ContainsKey($v) -or [string]::IsNullOrWhiteSpace($env[$v])) {
        Write-Fail "Missing: $v" "Add $v=<value> to .env"
        continue
    }
    $val = $env[$v]
    foreach ($pat in $placeholders) {
        if ($val -like "*$pat*") {
            Write-Fail "$v still has placeholder value" "Set a real value for $v in .env (current: $val)"
            break
        }
    }
}

if ($env.ContainsKey('MCP_SERVER_URL') -and $env['MCP_SERVER_URL'] -notmatch '^http://mcp-server:') {
    Write-Fail "MCP_SERVER_URL must be 'http://mcp-server:3100' for Docker deploy" `
        "In .env, set: MCP_SERVER_URL=http://mcp-server:3100"
}
if ($env.ContainsKey('RAGFLOW_BASE_URL') -and $env['RAGFLOW_BASE_URL'] -match '127\.0\.0\.1|localhost') {
    Write-Fail "RAGFLOW_BASE_URL must use 'host.docker.internal' for Docker deploy" `
        "In .env, set: RAGFLOW_BASE_URL=http://host.docker.internal:9380"
}
if ($env.ContainsKey('CLOUDFLARE_TUNNEL_TOKEN') -and $env['CLOUDFLARE_TUNNEL_TOKEN'] -notmatch '^eyJ') {
    Write-Fail "CLOUDFLARE_TUNNEL_TOKEN does not look like a valid Cloudflare tunnel token" `
        "Obtain the token from Cloudflare Zero Trust dashboard"
}

if ($script:Failed.Count -gt 0) { Stop-OnFailures }
Write-Pass "All required .env variables present and non-placeholder"

# -----------------------------------------------------------------------------
# 2b. Auto-generate MCP JWT token (365-day)
# -----------------------------------------------------------------------------
$nodeAvailable = $null -ne (Get-Command node -ErrorAction SilentlyContinue)
if ($nodeAvailable -and $env.ContainsKey('MCP_JWT_SECRET') -and $env['MCP_JWT_SECRET'].Length -ge 32) {
    $secret = $env['MCP_JWT_SECRET']
    $newToken = node -e @"
const c=require('crypto'),h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),n=Math.floor(Date.now()/1000),p=Buffer.from(JSON.stringify({sub:'app-nextjs',iat:n,exp:n+31536000})).toString('base64url'),s=c.createHmac('sha256','$secret').update(h+'.'+p).digest('base64url');console.log(h+'.'+p+'.'+s);
"@ 2>&1

    if ($LASTEXITCODE -eq 0 -and $newToken -match '^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$') {
        $content = [System.IO.File]::ReadAllText($envFile)
        if ($content -match 'MCP_JWT_TOKEN=') {
            $content = $content -replace '(?m)^MCP_JWT_TOKEN=.*$', "MCP_JWT_TOKEN=$newToken"
        } else {
            $content = $content.TrimEnd() + "`nMCP_JWT_TOKEN=$newToken`n"
        }
        [System.IO.File]::WriteAllText($envFile, $content, [System.Text.Encoding]::UTF8)
        $env['MCP_JWT_TOKEN'] = $newToken
        Write-Pass "MCP_JWT_TOKEN regenerated with 365-day expiry"
    } else {
        Write-Warn "Could not auto-generate MCP_JWT_TOKEN - using value from .env"
    }
} elseif (-not $nodeAvailable) {
    Write-Warn "node.js not on PATH - skipping MCP_JWT_TOKEN auto-generation"
} else {
    Write-Warn "MCP_JWT_SECRET too short or missing - skipping MCP_JWT_TOKEN generation"
}

# -----------------------------------------------------------------------------
# 3. Docker internal networking
# -----------------------------------------------------------------------------
Write-Section "3/4  Docker networking"

Write-Host "  Probing host.docker.internal (this starts a temporary container)..." -ForegroundColor DarkGray
$hostCheck = docker run --rm --pull missing alpine:3.19 sh -c "getent hosts host.docker.internal 2>/dev/null | head -1" 2>&1
if ($LASTEXITCODE -eq 0 -and $hostCheck -match '\d+\.\d+\.\d+\.\d+') {
    Write-Pass "host.docker.internal resolves to: $($hostCheck.Trim() -split '\s+' | Select-Object -First 1)"
} else {
    $hostCheck2 = docker run --rm --pull missing alpine:3.19 sh -c "nslookup host.docker.internal 2>&1" 2>&1
    if ($hostCheck2 -match 'Address: (\d+\.\d+\.\d+\.\d+)') {
        Write-Pass "host.docker.internal resolves ($($Matches[1]))"
    } else {
        Write-Warn "host.docker.internal may not resolve inside containers. If RAGflow queries fail, restart Docker Desktop."
    }
}

$ragflowUrl = if ($env.ContainsKey('RAGFLOW_BASE_URL')) { $env['RAGFLOW_BASE_URL'] } else { 'http://host.docker.internal:9380' }
Write-Host "  Probing RAGflow at $ragflowUrl ..." -ForegroundColor DarkGray
$ragCheck = docker run --rm --pull missing alpine:3.19 sh -c "wget -qO- --timeout=5 '$ragflowUrl' > /dev/null 2>&1; echo exit:`$?" 2>&1
if ($ragCheck -match 'exit:0') {
    Write-Pass "RAGflow reachable at $ragflowUrl"
} else {
    Write-Warn "RAGflow not reachable at $ragflowUrl - MCP server will start but RAGflow queries will fail."
}

# -----------------------------------------------------------------------------
# 4. MySQL TCP reachability
# -----------------------------------------------------------------------------
Write-Section "4/4  MySQL connectivity"

$mysqlHost = $env['MYSQL_HOST']
$mysqlPort = [int]$env['MYSQL_PORT']
$tcpOk = Test-NetConnection -ComputerName $mysqlHost -Port $mysqlPort `
             -InformationLevel Quiet -WarningAction SilentlyContinue 2>$null

if ($tcpOk) {
    Write-Pass "MySQL $mysqlHost`:$mysqlPort is reachable (TCP handshake OK)"
} else {
    Write-Warn "MySQL $mysqlHost`:$mysqlPort is NOT reachable - admin dashboard will show data unavailable."
}

# -----------------------------------------------------------------------------
# Pre-flight summary
# -----------------------------------------------------------------------------
Write-Host ""
Write-Hr
$wCount = $script:Warnings.Count
$fCount = $script:Failed.Count
Write-Host ("  Pre-flight: {0} failed  |  {1} warnings" -f $fCount, $wCount) -ForegroundColor $(if ($fCount -gt 0) { 'Red' } elseif ($wCount -gt 0) { 'Yellow' } else { 'Green' })
Write-Hr

if ($fCount -gt 0) { Stop-OnFailures }

if ($wCount -gt 0) {
    Write-Host "`n  Warnings (non-blocking):" -ForegroundColor Yellow
    foreach ($w in $script:Warnings) { Write-Host "  * $w" -ForegroundColor Yellow }
}

Write-Host "`n  All checks passed." -ForegroundColor Green

# -----------------------------------------------------------------------------
# Native Build (Bypasses Docker Memory Limitation)
# -----------------------------------------------------------------------------
Write-Section "Building Next.js Natively"

Push-Location $PSScriptRoot
try {
    Write-Host "  Installing Node modules (npm install)..." -ForegroundColor Cyan
    cmd.exe /c "npm install"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FAIL] npm ci failed. Please check dependencies." -ForegroundColor Red
        exit 1
    }

    Write-Host "  Running production build (npm run build)..." -ForegroundColor Cyan
    cmd.exe /c "npm run build"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FAIL] npm run build failed. Please check your code." -ForegroundColor Red
        exit 1
    }
    Write-Pass "Native build completed successfully."
} catch {
    Write-Fail "Native build process threw an error: $_"
    exit 1
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# Deploy via Docker
# -----------------------------------------------------------------------------
Write-Section "Deploying Docker Stack"
Write-Host "  docker compose up -d --build`n" -ForegroundColor Cyan

Push-Location $PSScriptRoot
try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FAIL] docker compose up failed - check output above" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

# -----------------------------------------------------------------------------
# Wait for health
# -----------------------------------------------------------------------------
Write-Host "`n  Waiting for containers to become healthy (up to 90s)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(90)
$allHealthy = $false
Start-Sleep 10

while ((Get-Date) -lt $deadline) {
    $psLines = docker compose --project-directory $PSScriptRoot ps --format json 2>&1 |
               Where-Object { $_ -match '^\s*\{' }
    $containers = $psLines | ForEach-Object {
        try { $_ | ConvertFrom-Json } catch { $null }
    } | Where-Object { $_ -ne $null }

    $unhealthy = @($containers | Where-Object { $_.Health -eq 'unhealthy' })
    $starting  = @($containers | Where-Object { $_.Health -eq 'starting'  })

    if ($unhealthy.Count -eq 0 -and $starting.Count -eq 0) {
        $allHealthy = $true
        break
    }
    Write-Host "  Still starting ($($starting.Count) starting, $($unhealthy.Count) unhealthy)..." -ForegroundColor DarkGray
    Start-Sleep 8
}

# -----------------------------------------------------------------------------
# Status report
# -----------------------------------------------------------------------------
Write-Section "Status"

$psLines = docker compose --project-directory $PSScriptRoot ps --format json 2>&1 |
           Where-Object { $_ -match '^\s*\{' }
$containers = $psLines | ForEach-Object {
    try { $_ | ConvertFrom-Json } catch { $null }
} | Where-Object { $_ -ne $null }

foreach ($c in $containers) {
    $health = if ($c.Health) { $c.Health } else { 'no-healthcheck' }
    $ok     = ($c.State -eq 'running') -and ($health -ne 'unhealthy')
    $color  = if ($ok) { 'Green' } else { 'Red' }
    $icon   = if ($ok) { '[OK]' } else { '[!!]' }
    Write-Host ("  $icon  {0,-45} {1,-10} {2}" -f $c.Name, $c.State, $health) -ForegroundColor $color
}

# Internal health probe through Docker network
Write-Host ""
$healthProbe = docker run --rm --pull missing `
    --network "bamboo-vet-prod_bamboo-net" `
    alpine:3.19 `
    sh -c "wget -qO- --timeout=5 http://next-app:3000/api/health 2>&1" 2>&1
if ($healthProbe -match '"ok":true') {
    Write-Host "  Internal /api/health -> $($healthProbe.Trim())" -ForegroundColor Green
} else {
    Write-Host "  Internal /api/health: $healthProbe" -ForegroundColor Yellow
}

# Cloudflare tunnel registration check
Write-Host ""
Write-Host "  Checking Cloudflare tunnel status..." -ForegroundColor DarkGray
$cfLogs = docker compose --project-directory $PSScriptRoot logs cloudflared --tail 30 2>&1
if ($cfLogs -match 'Registered tunnel connection') {
    Write-Host "  Cloudflare tunnel: registered and connected" -ForegroundColor Green
} elseif ($cfLogs -match 'failed|error|invalid') {
    Write-Host "  Cloudflare tunnel: connection issue detected - check logs:" -ForegroundColor Red
    Write-Host "    docker compose logs cloudflared --tail 50" -ForegroundColor Cyan
} else {
    Write-Host "  Cloudflare tunnel: still connecting (may take 30s on first start)" -ForegroundColor Yellow
    Write-Host "    Monitor: docker compose logs cloudflared -f" -ForegroundColor DarkGray
}

# -----------------------------------------------------------------------------
# Final instructions
# -----------------------------------------------------------------------------
$domain = $env['PRODUCTION_DOMAIN']

Write-Host ""
Write-Hr

if ($allHealthy) {
    Write-Host "  Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Your app: https://$domain" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  IMPORTANT - First-run certificate note:" -ForegroundColor White
    Write-Host "    * Cloudflare provisions the HTTPS certificate automatically" -ForegroundColor White
    Write-Host "    * No port forwarding or router changes needed" -ForegroundColor White
    Write-Host "    * If the tunnel token is new, allow 30-60s for Cloudflare to go Active" -ForegroundColor White
    Write-Host "    * Verify tunnel health at: https://one.dash.cloudflare.com -> Networks -> Tunnels" -ForegroundColor White
    Write-Host ""
    Write-Host "  Useful commands:" -ForegroundColor White
    Write-Host "    docker compose logs cloudflared --tail 50   # watch tunnel connection" -ForegroundColor DarkGray
    Write-Host "    docker compose logs --tail 20               # all services" -ForegroundColor DarkGray
    Write-Host "    docker compose ps                           # container health" -ForegroundColor DarkGray
    Write-Host "    docker compose down                         # stop everything" -ForegroundColor DarkGray
    Write-Host "    .\deploy.ps1                                # update + restart (safe to re-run)" -ForegroundColor DarkGray
} else {
    Write-Host "  Deployment launched but some containers are not yet healthy." -ForegroundColor Yellow
    Write-Host "  Run: docker compose ps" -ForegroundColor White
    Write-Host "  Diagnose: docker compose logs <service>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Common issues:" -ForegroundColor White
    Write-Host "    cloudflared unhealthy -> check CLOUDFLARE_TUNNEL_TOKEN in .env; verify tunnel exists in dashboard" -ForegroundColor DarkGray
    Write-Host "    next-app unhealthy    -> check SUPABASE_* and MCP_SERVER_URL in .env" -ForegroundColor DarkGray
    Write-Host "    mcp-server unhealthy  -> check RAGFLOW_BASE_URL and RAGflow is running" -ForegroundColor DarkGray
}

Write-Hr