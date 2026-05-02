#Requires -Version 5.1
<#
.SYNOPSIS
    Bamboo Vet AI — pre-flight checks + Docker deployment

.DESCRIPTION
    Runs 7 pre-flight checks then deploys with docker compose.
    Safe to run repeatedly (idempotent). Fails fast with copy-paste fixes.

.EXAMPLE
    .\deploy.ps1
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:ExitCode = 0

# ─────────────────────────────────────────────────────────────────────────────
# Output helpers
# ─────────────────────────────────────────────────────────────────────────────
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
function Write-Section { param([string]$title) Write-Host "`n━━━ $title ━━━" -ForegroundColor White }
function Write-Hr      { Write-Host ("━" * 60) -ForegroundColor DarkGray }

function Stop-OnFailures {
    Write-Host "`n" -NoNewline
    Write-Hr
    Write-Host "  PRE-FLIGHT FAILED — fix the items above then re-run .\deploy.ps1" -ForegroundColor Red
    Write-Hr
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# Header
# ─────────────────────────────────────────────────────────────────────────────
Write-Hr
Write-Host "  Bamboo Vet AI — Deployment Pre-Flight" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  •  $env:COMPUTERNAME" -ForegroundColor DarkGray
Write-Hr

# ─────────────────────────────────────────────────────────────────────────────
# 1. Docker Compose v2
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "1/7  Docker Compose v2"

try {
    $verOutput = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
    $verString = ($verOutput -join '') -replace '[^0-9.]', '' | Select-Object -First 1
    # verString may be like "2.35.1" — grab first token
    $verString = (($verOutput -join '') | Select-String '\d+\.\d+\.\d+').Matches[0].Value
    $major = [int]($verString -split '\.')[0]
    if ($major -ge 2) {
        Write-Pass "Docker Compose $verString"
    } else {
        Write-Fail "Docker Compose $verString is too old (need v2+)" `
            "Update Docker Desktop to 4.x or later: https://www.docker.com/products/docker-desktop"
    }
} catch {
    Write-Fail "docker compose not found" `
        "Install Docker Desktop: https://www.docker.com/products/docker-desktop"
}
if ($script:Failed.Count -gt 0) { Stop-OnFailures }

# ─────────────────────────────────────────────────────────────────────────────
# 2. Parse .env
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "2/7  .env validation"

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
        # Strip inline comments (everything after unquoted #)
        $val = $Matches[2] -replace '\s+#.*$', ''
        $env[$Matches[1]] = $val.Trim()
    }
}

# Required vars — placeholder patterns that indicate the user hasn't filled them in
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
    'DOMAIN',
    'LETSENCRYPT_EMAIL',
    'DUCKDNS_SUBDOMAIN',
    'DUCKDNS_TOKEN'
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

# Docker-specific value checks — common mistakes from copy-pasting local dev .env
if ($env.ContainsKey('MCP_SERVER_URL') -and $env['MCP_SERVER_URL'] -notmatch '^http://mcp-server:') {
    Write-Fail "MCP_SERVER_URL must be 'http://mcp-server:3100' for Docker deploy" `
        "In .env, set: MCP_SERVER_URL=http://mcp-server:3100"
}
if ($env.ContainsKey('RAGFLOW_BASE_URL') -and $env['RAGFLOW_BASE_URL'] -match '127\.0\.0\.1|localhost') {
    Write-Fail "RAGFLOW_BASE_URL must use 'host.docker.internal' for Docker deploy" `
        "In .env, set: RAGFLOW_BASE_URL=http://host.docker.internal:9380"
}
if ($env.ContainsKey('DOMAIN') -and $env['DOMAIN'] -eq 'localhost') {
    Write-Fail "DOMAIN is set to 'localhost' — this must be your real DuckDNS domain" `
        "In .env, set: DOMAIN=<your-subdomain>.duckdns.org"
}
if ($env.ContainsKey('LETSENCRYPT_EMAIL') -and $env['LETSENCRYPT_EMAIL'] -notmatch '@') {
    Write-Fail "LETSENCRYPT_EMAIL does not look like a valid email address" `
        "In .env, set: LETSENCRYPT_EMAIL=you@example.com"
}

if ($script:Failed.Count -gt 0) { Stop-OnFailures }
Write-Pass "All required .env variables present and non-placeholder"

# ─────────────────────────────────────────────────────────────────────────────
# 2b. Auto-generate MCP JWT token (365-day)
# ─────────────────────────────────────────────────────────────────────────────
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
        Write-Warn "Could not auto-generate MCP_JWT_TOKEN — using value from .env"
    }
} elseif (-not $nodeAvailable) {
    Write-Warn "node.js not on PATH — skipping MCP_JWT_TOKEN auto-generation (using .env value)"
} else {
    Write-Warn "MCP_JWT_SECRET too short or missing — skipping MCP_JWT_TOKEN generation"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. Port availability
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "3/7  Port availability"

$httpPort  = if ($env.ContainsKey('HTTP_PORT')  -and $env['HTTP_PORT']  -match '^\d+$') { [int]$env['HTTP_PORT']  } else { 80  }
$httpsPort = if ($env.ContainsKey('HTTPS_PORT') -and $env['HTTPS_PORT'] -match '^\d+$') { [int]$env['HTTPS_PORT'] } else { 443 }

function Test-PortFree([int]$port) {
    $l = $null
    try {
        $l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $port)
        $l.Start(); $l.Stop(); return $true
    } catch { return $false } finally { if ($l) { try { $l.Stop() } catch {} } }
}

function Get-PortOwner([int]$port) {
    try {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) { return (Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue).Name }
    } catch {}
    return $null
}

foreach ($p in @($httpPort, $httpsPort)) {
    $label = if ($p -eq $httpPort) { "HTTP" } else { "HTTPS" }
    if (Test-PortFree $p) {
        Write-Pass "Port $p ($label) is free"
    } else {
        $owner = Get-PortOwner $p
        $ownerMsg = if ($owner) { " (used by: $owner)" } else { "" }
        Write-Fail "Port $p ($label) is already in use$ownerMsg" `
            "Stop the service using port $p, OR add $($label)_PORT=<other-port> to .env"
    }
}

if ($script:Failed.Count -gt 0) { Stop-OnFailures }

# ─────────────────────────────────────────────────────────────────────────────
# 4. Windows Firewall
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "4/7  Windows Firewall"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)

function Test-FirewallAllowsPort([int]$port) {
    # Returns true if any enabled inbound Allow rule covers this TCP port
    $rules = Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction SilentlyContinue
    foreach ($r in $rules) {
        $pf = $r | Get-NetFirewallPortFilter -ErrorAction SilentlyContinue
        if ($pf -and $pf.Protocol -in @('TCP', 'Any') -and ($pf.LocalPort -eq $port -or $pf.LocalPort -eq 'Any')) {
            return $true
        }
    }
    return $false
}

foreach ($p in @($httpPort, $httpsPort)) {
    $label = if ($p -eq $httpPort) { "HTTP" } else { "HTTPS" }
    if (Test-FirewallAllowsPort $p) {
        Write-Pass "Firewall: inbound TCP $p ($label) is allowed"
    } elseif ($isAdmin) {
        try {
            New-NetFirewallRule -DisplayName "Bamboo Vet $label ($p)" `
                -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow | Out-Null
            Write-Pass "Firewall: created inbound Allow rule for TCP $p ($label)"
        } catch {
            Write-Fail "Could not create firewall rule for port $p" `
                "Run as Admin: New-NetFirewallRule -DisplayName 'Bamboo Vet $label' -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow"
        }
    } else {
        Write-Fail "No firewall Allow rule for port $p and script is not running as Administrator" `
            "Right-click deploy.ps1 → 'Run as Administrator', OR run manually:`n         New-NetFirewallRule -DisplayName 'Bamboo Vet $label' -Direction Inbound -Protocol TCP -LocalPort $p -Action Allow"
    }
}

if ($script:Failed.Count -gt 0) { Stop-OnFailures }

# ─────────────────────────────────────────────────────────────────────────────
# 5. Docker internal networking
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "5/7  Docker networking"

# host.docker.internal
Write-Host "  Probing host.docker.internal (this starts a temporary container)..." -ForegroundColor DarkGray
$hostCheck = docker run --rm --pull never alpine:3.19 sh -c "getent hosts host.docker.internal 2>/dev/null | head -1" 2>&1
if ($LASTEXITCODE -eq 0 -and $hostCheck -match '\d+\.\d+\.\d+\.\d+') {
    Write-Pass "host.docker.internal resolves to: $($hostCheck.Trim() -split '\s+' | Select-Object -First 1)"
} else {
    # Fallback: try nslookup
    $hostCheck2 = docker run --rm --pull never alpine:3.19 sh -c "nslookup host.docker.internal 2>&1" 2>&1
    if ($hostCheck2 -match 'Address: (\d+\.\d+\.\d+\.\d+)') {
        Write-Pass "host.docker.internal resolves ($($Matches[1]))"
    } else {
        Write-Warn "host.docker.internal may not resolve inside containers. Docker Desktop should set this automatically — if RAGflow queries fail, restart Docker Desktop."
    }
}

# RAGflow reachability from inside Docker
$ragflowUrl = if ($env.ContainsKey('RAGFLOW_BASE_URL')) { $env['RAGFLOW_BASE_URL'] } else { 'http://host.docker.internal:9380' }
Write-Host "  Probing RAGflow at $ragflowUrl ..." -ForegroundColor DarkGray
$ragCheck = docker run --rm --pull never alpine:3.19 sh -c "wget -qO- --timeout=5 '$ragflowUrl' > /dev/null 2>&1; echo exit:`$?" 2>&1
if ($ragCheck -match 'exit:0') {
    Write-Pass "RAGflow reachable at $ragflowUrl"
} else {
    Write-Warn "RAGflow not reachable at $ragflowUrl — MCP server will start but RAGflow queries will fail. Ensure the RAGflow Docker container is running."
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. DuckDNS domain → public IP
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "6/7  DuckDNS domain → public IP"

$domain = $env['DOMAIN']
$publicIp = $null
try {
    $r = Invoke-WebRequest -Uri 'https://ifconfig.me/ip' -UseBasicParsing -TimeoutSec 6
    $publicIp = $r.Content.Trim()
} catch {
    try {
        $r = Invoke-WebRequest -Uri 'https://api.ipify.org' -UseBasicParsing -TimeoutSec 6
        $publicIp = $r.Content.Trim()
    } catch { $publicIp = $null }
}

$resolvedIp = $null
try {
    $resolvedIp = ([Net.Dns]::GetHostAddresses($domain) | Where-Object { $_.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1).IPAddressToString
} catch {}

if ($publicIp -and $resolvedIp) {
    if ($resolvedIp -eq $publicIp) {
        Write-Pass "$domain → $publicIp (matches this server's public IP)"
    } else {
        Write-Warn "$domain resolves to $resolvedIp but server public IP is $publicIp`n         Update DuckDNS at https://www.duckdns.org, then wait 2 minutes and re-run`n         (Let's Encrypt cert provisioning will fail if DNS points elsewhere)"
    }
} elseif ($publicIp) {
    Write-Warn "Could not resolve $domain — go to https://www.duckdns.org and set IP to $publicIp"
} else {
    Write-Warn "Could not determine public IP or resolve $domain — verify DuckDNS manually"
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. MySQL TCP reachability
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "7/7  MySQL connectivity"

$mysqlHost = $env['MYSQL_HOST']
$mysqlPort = [int]$env['MYSQL_PORT']
$tcpOk = Test-NetConnection -ComputerName $mysqlHost -Port $mysqlPort `
             -InformationLevel Quiet -WarningAction SilentlyContinue 2>$null

if ($tcpOk) {
    Write-Pass "MySQL $mysqlHost`:$mysqlPort is reachable (TCP handshake OK)"
} else {
    Write-Warn "MySQL $mysqlHost`:$mysqlPort is NOT reachable from this server — admin dashboard will show 'Không thể tải dữ liệu'. Verify this server's IP is whitelisted on the MySQL firewall."
}

# ─────────────────────────────────────────────────────────────────────────────
# Pre-flight summary
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Hr
$wCount = $script:Warnings.Count
$fCount = $script:Failed.Count
$wColor = if ($wCount -gt 0) { 'Yellow' } else { 'Green' }
Write-Host ("  Pre-flight: {0} failed  •  {1} warnings" -f $fCount, $wCount) -ForegroundColor $(if ($fCount -gt 0) { 'Red' } elseif ($wCount -gt 0) { 'Yellow' } else { 'Green' })
Write-Hr

if ($fCount -gt 0) { Stop-OnFailures }

if ($wCount -gt 0) {
    Write-Host "`n  Warnings (non-blocking):" -ForegroundColor Yellow
    foreach ($w in $script:Warnings) { Write-Host "  • $w" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "  All checks passed. Starting deployment..." -ForegroundColor Green

# ─────────────────────────────────────────────────────────────────────────────
# Deploy
# ─────────────────────────────────────────────────────────────────────────────
Write-Section "Deploying"
Write-Host "  docker compose up -d --build`n" -ForegroundColor Cyan

Push-Location $PSScriptRoot
try {
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n[FAIL] docker compose up failed — check output above" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}

# ─────────────────────────────────────────────────────────────────────────────
# Wait for health
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n  Waiting for containers to become healthy (up to 90s)..." -ForegroundColor Cyan
$deadline = (Get-Date).AddSeconds(90)
$allHealthy = $false
Start-Sleep 10

while ((Get-Date) -lt $deadline) {
    # docker compose ps NDJSON — one object per line
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

# ─────────────────────────────────────────────────────────────────────────────
# Status report
# ─────────────────────────────────────────────────────────────────────────────
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
    $icon   = if ($ok) { '✓' } else { '✗' }
    Write-Host ("  $icon  {0,-45} {1,-10} {2}" -f $c.Name, $c.State, $health) -ForegroundColor $color
}

# Internal health probe through Docker network (avoids DNS/Caddy)
Write-Host ""
$healthProbe = docker run --rm --pull never `
    --network "bamboo-vet-prod_bamboo-net" `
    alpine:3.19 `
    sh -c "wget -qO- --timeout=5 http://next-app:3000/api/health 2>&1" 2>&1
if ($healthProbe -match '"ok":true') {
    Write-Host "  Internal /api/health → $($healthProbe.Trim())" -ForegroundColor Green
} else {
    Write-Host "  Internal /api/health: $healthProbe" -ForegroundColor Yellow
}

# ─────────────────────────────────────────────────────────────────────────────
# Final instructions
# ─────────────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Hr

if ($allHealthy) {
    Write-Host "  Deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Your app: https://$domain" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  IMPORTANT — First-run HTTPS setup (one-time):" -ForegroundColor White
    Write-Host "    • Caddy is requesting a Let's Encrypt certificate for $domain" -ForegroundColor White
    Write-Host "    • This requires port $httpPort to be reachable from the internet" -ForegroundColor White
    Write-Host "    • The certificate is usually ready within 30-60 seconds" -ForegroundColor White
    Write-Host "    • If https://$domain shows a cert error, wait 60s then refresh" -ForegroundColor White
    Write-Host ""
    Write-Host "  Useful commands:" -ForegroundColor White
    Write-Host "    docker compose logs caddy --tail 50   # watch cert provisioning" -ForegroundColor DarkGray
    Write-Host "    docker compose logs --tail 20         # all services" -ForegroundColor DarkGray
    Write-Host "    docker compose ps                     # container health" -ForegroundColor DarkGray
    Write-Host "    docker compose down                   # stop everything" -ForegroundColor DarkGray
    Write-Host "    .\deploy.ps1                          # update + restart (safe to re-run)" -ForegroundColor DarkGray
} else {
    Write-Host "  Deployment launched but some containers are not yet healthy." -ForegroundColor Yellow
    Write-Host "  Run: docker compose ps" -ForegroundColor White
    Write-Host "  Diagnose: docker compose logs <service>" -ForegroundColor White
    Write-Host ""
    Write-Host "  Common issues:" -ForegroundColor White
    Write-Host "    caddy unhealthy  → check DOMAIN, LETSENCRYPT_EMAIL in .env; ensure port $httpPort is open to internet" -ForegroundColor DarkGray
    Write-Host "    next-app unhealthy  → check SUPABASE_* and MCP_SERVER_URL in .env" -ForegroundColor DarkGray
    Write-Host "    mcp-server unhealthy  → check RAGFLOW_BASE_URL and RAGflow is running" -ForegroundColor DarkGray
}

Write-Hr
