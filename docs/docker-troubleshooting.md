# Docker Deployment — Troubleshooting Guide

Run `docker compose ps` first to identify which container is failing, then jump to the relevant section.

---

## Caddy is `Restarting` or `unhealthy`

### 1. Check Caddy logs

```powershell
docker compose logs caddy --tail 50
```

### 2. Common causes and fixes

**`unrecognized directive: flush_interval`**
The Caddyfile has `flush_interval` at the wrong level. It must be inside the `reverse_proxy {}` block, not at the site block level.

**`Error: adapting config using caddyfile`**
Syntax error in `Caddyfile`. Check for missing braces, extra whitespace, or unresolved `{$VAR}` placeholders (means `.env` is missing a value).

**`Error getting certificate: ACME: ...`**
Let's Encrypt cert provisioning failed. Most common reasons:
- Domain DNS doesn't point to this server yet → update DuckDNS IP and wait 2 min
- Port 80 is not reachable from the internet → check router NAT port forwarding (80 and 443 → server LAN IP)
- Port 80 is occupied on the host → `netstat -ano | findstr :80` to find the process

**`Bind for 0.0.0.0:80 failed: port is already allocated`**
Something else is using port 80. Find it:
```powershell
netstat -ano | findstr :80
Get-Process -Id <PID>
```
Options: stop that service, OR set `HTTP_PORT=8080` in `.env` (and update DuckDNS / router port forward to 8080 instead of 80).

---

## next-app is `unhealthy`

### 1. Check logs

```powershell
docker compose logs next-app --tail 50
```

### 2. Common causes and fixes

**Server starts but health check fails**
Run this probe inside the container:
```powershell
docker exec bamboo-vet-prod-next-app-1 sh -c "wget -qO- http://127.0.0.1:3000/api/health"
```
If it returns `{"ok":true}`, the health check command itself is wrong in the Dockerfile. If it returns connection refused, the Next.js server failed to start.

**`Error: NEXT_PUBLIC_SUPABASE_URL is not defined`**
These values are baked into the image at build time. If they're missing, the image was built without the correct `.env` values. Run `docker compose down` then `docker compose up -d --build` (which re-reads `.env`).

**`Module not found` / TypeScript errors at startup**
The standalone build failed. Re-run `docker compose up -d --build` and watch the build output for errors.

---

## mcp-server is `unhealthy`

### 1. Check logs

```powershell
docker compose logs mcp-server --tail 50
```

### 2. Check the health endpoint directly

```powershell
docker exec bamboo-vet-prod-mcp-server-1 wget -qO- http://127.0.0.1:3100/health
```
Should return `{"ok":true}`. If it returns connection refused, the server crashed on startup.

### 3. Common causes and fixes

**`tsx: command not found`**
The `node_modules/.bin/tsx` binary is missing. Rebuild: `docker compose up -d --build --no-cache mcp-server`

**Connection errors to RAGflow during queries (not at startup)**
The MCP server itself starts fine; RAGflow queries fail at runtime.

Verify RAGflow is reachable from inside Docker:
```powershell
docker run --rm alpine:3.19 sh -c "wget -qO- http://host.docker.internal:9380/ 2>&1 | head -c 200"
```
If this returns connection refused:
1. Confirm RAGflow Docker container is running: `docker ps | findstr ragflow`
2. Check RAGflow is listening on port 9380: look in the RAGflow docker-compose for the port mapping
3. Restart RAGflow if needed

---

## Admin dashboard shows "Không thể tải dữ liệu"

MySQL is not reachable from the Docker container. This is a network/firewall issue, not an app bug.

### 1. Check MySQL connectivity from the host

```powershell
Test-NetConnection -ComputerName 14.225.203.126 -Port 3306 -InformationLevel Quiet
```

Should return `True`. If `False`:
- This server's IP is not whitelisted on the corporate MySQL firewall
- Contact the DBA to add this server's public IP to the MySQL allowlist

### 2. Verify the credentials in .env

```powershell
docker run --rm mysql:8.0 mysql -h 14.225.203.126 -P 3306 -u $env:MYSQL_USER -p$env:MYSQL_PASSWORD -e "SELECT 1"
```

If this fails with `Access denied`, the user/password in `.env` is wrong.

### 3. SSL handshake errors

If logs show `SSL handshake failed` or similar, try setting `MYSQL_SSL=false` in `.env` and re-run `deploy.ps1`.

---

## Chat returns an error or hangs

### 1. Check MCP server is healthy

```powershell
docker compose ps mcp-server
docker compose logs mcp-server --tail 20
```

### 2. MCP JWT token might be expired

`deploy.ps1` auto-generates a 365-day token. If you deployed without running `deploy.ps1`, the token might be expired (the old dev token was valid only 30 days).

Fix: re-run `.\deploy.ps1` — it regenerates the token and restarts the stack.

### 3. Verify next-app can reach mcp-server

```powershell
docker run --rm --network bamboo-vet-prod_bamboo-net alpine:3.19 sh -c "wget -qO- http://mcp-server:3100/health"
```
Should return `{"ok":true}`. If not, the Docker network is broken — run `docker compose down && docker compose up -d --build`.

---

## Container keeps restarting in a loop

```powershell
docker inspect --format='{{json .State.Health}}' bamboo-vet-prod-<service>-1
```

Look at the `Log` array — it shows the last 5 health check outputs with exact error messages.

Also check the restart count:
```powershell
docker compose ps
```
A container showing `Restarting (1) X seconds ago` is in a restart loop.

Common fixes:
- Check `.env` for missing/wrong values
- Re-run `docker compose down && docker compose up -d --build` (rebuilds images and re-reads `.env`)
- Check disk space: `Get-PSDrive C` — Docker images need at least 5GB free

---

## "This site can't be reached" in browser

In order of likelihood:

1. **DNS not propagated yet** — `Resolve-DnsName bamboo-vet-ai.duckdns.org` returns wrong IP → update DuckDNS and wait
2. **Port 80/443 blocked on router** — router doesn't forward these ports to the server → configure NAT port forwarding
3. **Windows Firewall** — run: `Get-NetFirewallRule | Where Enabled -eq True | Get-NetFirewallPortFilter | Where LocalPort -in @(80,443)`
   If nothing returns, create the rules:
   ```powershell
   New-NetFirewallRule -DisplayName "Bamboo Vet HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
   New-NetFirewallRule -DisplayName "Bamboo Vet HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
   ```
4. **Caddy container not running** — `docker compose ps` — caddy should be `Up`

---

## Nuclear option — full clean restart

If nothing else works, completely tear down and rebuild from scratch:

```powershell
docker compose down --volumes --remove-orphans    # removes containers AND caddy TLS volumes
docker compose up -d --build --no-cache           # full rebuild, re-requests cert
```

> `--volumes` removes the `caddy_data` volume which holds the Let's Encrypt cert cache.
> Caddy will request a fresh certificate on next startup.
