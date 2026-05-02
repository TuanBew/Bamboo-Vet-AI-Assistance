# Company Server Setup — One-Time Deployment Guide

This is the complete setup guide for deploying Bamboo Vet AI to the company Windows 11 server.
Estimated time: **20-30 minutes** on first run.

---

## Prerequisites checklist

Before starting, confirm every item below is checked:

| # | Item | How to check |
|---|------|-------------|
| 1 | Windows 11 + admin/RDP access | Open RDP session and confirm you can run PowerShell as Administrator |
| 2 | Docker Desktop installed and running | Run `docker version` in PowerShell — must return without error |
| 3 | RAGflow Docker container running | Run `docker ps` and confirm a ragflow container is listed as `Up` |
| 4 | Public IP is reachable on ports 80/443 | If the server is behind a router/NAT, port-forward 80 and 443 to this server's LAN IP |
| 5 | Corporate MySQL is accessible | `Test-NetConnection 14.225.203.126 -Port 3306` — must show `TcpTestSucceeded: True` |

---

## Step 1 — Register a DuckDNS subdomain (one-time, ~5 minutes)

1. Open **https://www.duckdns.org** in a browser
2. Sign in with Google or GitHub
3. Under "Add a subdomain", type: `bamboo-vet-ai` → click **Add Domain**
   - If `bamboo-vet-ai` is taken, pick another name (e.g. `bamboovet-ai`, `bamboo-vet-vn`)
4. Find the server's **public IP address**:
   ```powershell
   Invoke-WebRequest -Uri 'https://ifconfig.me/ip' -UseBasicParsing | Select-Object -ExpandProperty Content
   ```
5. Enter that IP in the DuckDNS "current ip" field → click **Update IP**
6. Copy the **DuckDNS Token** shown at the top of the dashboard (you'll need it in Step 3)

> After updating, wait **2 minutes** for DNS to propagate before running `deploy.ps1`.
> Verify: `Resolve-DnsName bamboo-vet-ai.duckdns.org` — should return your public IP.

---

## Step 2 — Transfer the project to the company server

On your **development machine**, ZIP the entire project folder:

```powershell
Compress-Archive -Path "D:\importantProjects\...\bamboo-docker\*" -DestinationPath bamboo-vet.zip -CompressionLevel Fastest
```

Copy `bamboo-vet.zip` to the company server via RDP file transfer, USB drive, or network share.

On the **company server**, extract to a folder:

```powershell
Expand-Archive -Path bamboo-vet.zip -DestinationPath C:\bamboo-vet-ai
cd C:\bamboo-vet-ai
```

---

## Step 3 — Configure .env

```powershell
Copy-Item .env.example .env
notepad .env
```

Fill in every variable. The table below shows what each section needs:

### Supabase (no changes needed — values copied from dev machine)
| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page → service_role key |

### RAGflow (Docker-specific values)
| Variable | Value |
|---|---|
| `RAGFLOW_BASE_URL` | `http://host.docker.internal:9380` ← must be this exact value for Docker |
| `RAGFLOW_API_KEY` | Copy from dev machine `.env` |
| `RAGFLOW_CHAT_ID` | Copy from dev machine `.env` |

### MCP Server (Docker-specific)
| Variable | Value |
|---|---|
| `MCP_SERVER_URL` | `http://mcp-server:3100` ← must be this exact value for Docker |
| `MCP_JWT_SECRET` | Copy from dev machine `mcp-server/.env` |
| `MCP_JWT_TOKEN` | Leave empty — `deploy.ps1` auto-generates a 365-day token |
| `MCP_CHAT_ID` | Same value as `RAGFLOW_CHAT_ID` |

### MySQL
| Variable | Value |
|---|---|
| `MYSQL_HOST` | `14.225.203.126` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_DATABASE` | Copy from dev machine |
| `MYSQL_USER` | Copy from dev machine |
| `MYSQL_PASSWORD` | Ask the DBA if not known |
| `MYSQL_SSL` | `true` |

### Upstash + Gemini (no changes from dev machine)
Copy `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and `GEMINI_API_KEY` from the dev `.env`.

### Docker deployment (fill in with your DuckDNS values)
| Variable | Example value |
|---|---|
| `DOMAIN` | `bamboo-vet-ai.duckdns.org` |
| `LETSENCRYPT_EMAIL` | your email address |
| `DUCKDNS_SUBDOMAIN` | `bamboo-vet-ai` ← subdomain only, not the full .duckdns.org domain |
| `DUCKDNS_TOKEN` | Token from DuckDNS dashboard |

### Port overrides (only change if needed)
Leave `HTTP_PORT` and `HTTPS_PORT` **commented out** (defaults to 80 and 443).
Only set them if another service already uses those ports.

---

## Step 4 — Run deploy.ps1

Right-click `deploy.ps1` → **Run with PowerShell** (as Administrator), or from an elevated PowerShell terminal:

```powershell
cd C:\bamboo-vet-ai
.\deploy.ps1
```

The script will:
1. Verify Docker Compose v2
2. Validate your `.env` (fails with clear instructions if anything is wrong)
3. Auto-generate a 365-day MCP JWT token
4. Check ports 80 and 443 are free
5. Create Windows Firewall rules if needed
6. Verify `host.docker.internal` + RAGflow from inside Docker
7. Check DuckDNS DNS resolution
8. Check MySQL TCP reachability
9. Run `docker compose up -d --build`
10. Wait for all containers to become healthy
11. Print final status and HTTPS URL

**If any pre-flight check fails**, the script stops and prints the exact fix. Fix it and re-run.

---

## Step 5 — First-run verification (~2 minutes after deploy)

### Verify HTTPS certificate was issued

```powershell
docker compose logs caddy --tail 30 | Select-String 'cert|tls|acme|error' -CaseSensitive:$false
```

You should see lines like:
```
managed certificate ... obtained certificate
serving initial configuration
```

If you see `error` lines about ACME/Let's Encrypt, see `docs/docker-troubleshooting.md`.

### Open the app in a browser

Navigate to `https://bamboo-vet-ai.duckdns.org` (use your actual subdomain).

| Expected | Not expected |
|---|---|
| ✅ HTTPS padlock | ❌ "Your connection is not private" (cert not yet issued — wait 60s) |
| ✅ Login page renders | ❌ "502 Bad Gateway" (next-app still starting — wait 15s) |
| ✅ Admin login works | ❌ "This site can't be reached" (DNS mismatch or port 80/443 blocked) |

### Verify admin dashboard data loads

Log in as admin and navigate to `/admin/dashboard`. The KPI cards should show real sales numbers from MySQL. If they show "Không thể tải dữ liệu", MySQL is not reachable — see troubleshooting guide.

---

## Firewall commands (if deploy.ps1 didn't create them automatically)

Run in an **elevated** PowerShell:

```powershell
New-NetFirewallRule -DisplayName "Bamboo Vet HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "Bamboo Vet HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## Useful commands (run from `C:\bamboo-vet-ai`)

```powershell
docker compose ps                       # container health overview
docker compose logs --tail 30           # recent logs from all services
docker compose logs caddy --tail 50     # Caddy / cert provisioning logs
docker compose logs next-app --tail 50  # Next.js app logs
docker compose logs mcp-server --tail 50 # MCP server logs
docker compose down                     # stop everything
.\deploy.ps1                            # re-deploy after code updates (idempotent)
```

---

## Staging fallback

The Vercel deployment at **https://bamboo-vet-ai.vercel.app** remains live as a backup.
It has full auth + chat functionality. Admin dashboard data is not available (MySQL not reachable from Vercel serverless IPs).
