# Cloudflare Tunnel Guide — MCP Server

## Quick Start

```powershell
cd mcp-server
.\start-tunnel.ps1
```

That's it. The script starts the MCP server and tunnel together, and tells you exactly what to expect.

---

## Reading the Log — What Is Normal vs What Is a Real Error

Every time you run `cloudflared tunnel --url http://localhost:3100` you will see these lines. **Most of them are not errors.**

### Always appears — HARMLESS, ignore completely

```
ERR Cannot determine default origin certificate path. No file cert.pem ...
```
**Why it appears:** cloudflared looks for a TLS cert used by *named* tunnels. Quick tunnels (`--url`) never need it.  
**Impact:** zero. The tunnel connects regardless.

```
INF cloudflared does not support loading the system root certificate pool on Windows.
```
**Why it appears:** Windows doesn't expose a system cert store the same way Linux does.  
**Impact:** zero. Cloudflare's edge handles TLS, not your machine.

### The one line that tells you it worked

```
INF Registered tunnel connection connIndex=0 ... protocol=http2
```
When you see this line, **the tunnel is live**. Your `trycloudflare.com` URL is reachable from the internet.

### Lines that look like errors but are just shutdown messages

```
INF Initiating graceful shutdown due to signal interrupt ...
ERR Connection terminated connIndex=0
ERR no more connections active and exiting
```
**Cause:** you pressed Ctrl+C (or closed the terminal window).  
**Impact:** zero — you asked it to stop, it stopped cleanly.

---

## Why QUIC Failed Before (Already Fixed)

The original error was:

```
ERR Failed to dial a quic connection error="failed to dial to edge with quic: timeout"
```

**Root cause:** QUIC uses UDP port 443. Many routers and ISPs block UDP 443.  
**Fix (already applied):** `~/.cloudflared/config.yml` forces HTTP/2 (TCP) instead:

```yaml
protocol: http2
no-autoupdate: true
```

You never need to pass `--protocol http2` on the command line — the config handles it permanently.

---

## Step-by-Step Manual Run

If you prefer to run the commands yourself instead of the script:

### 1. Start the MCP server

```powershell
cd "D:\importantProjects\WorkSpace_Personal Project_ Agents\Bamboo Vet\mcp-server"
npm start
```

Wait for: `{"level":"info","msg":"MCP server listening","port":3100}`

### 2. Open a second terminal and start the tunnel

```powershell
cloudflared tunnel --url http://localhost:3100
```

Wait for: `INF Registered tunnel connection ... protocol=http2`  
Copy the `https://<random>.trycloudflare.com` URL from the box above it.

### 3. Test the connection

```powershell
$token = "<your-jwt-token>"   # from: npm run generate-token
$url   = "https://<random>.trycloudflare.com"

Invoke-RestMethod -Uri $url `
  -Method POST `
  -Headers @{ Authorization="Bearer $token"; Accept="application/json, text/event-stream" } `
  -ContentType "application/json" `
  -Body '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

**Expected response:** JSON containing `ragflow_chat` and `ragflow_list_chats` tools.  
If you see that, the full chain `Internet → Cloudflare → MCP → RAGflow` is proven.

---

## Generate or Renew a JWT Token

Tokens expire after 30 days by default. To generate a new one:

```powershell
cd "D:\importantProjects\WorkSpace_Personal Project_ Agents\Bamboo Vet\mcp-server"
npm run generate-token
```

For a named client with custom expiry:

```powershell
npm run generate-token claude-code 90d
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `ERR Failed to dial a quic connection ... timeout` | UDP 443 blocked | Check `~/.cloudflared/config.yml` has `protocol: http2` |
| `listen EADDRINUSE: address already in use :::3100` | Old MCP process still running | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3100).OwningProcess -Force` |
| `401 missing_token` from tunnel URL | No Bearer token in request | Add `Authorization: Bearer <token>` header |
| `401 invalid_token` | Token expired or wrong secret | Run `npm run generate-token` to get a fresh token |
| `429 rate_limited` | >60 req/min from same token | Wait 60 seconds or generate a second token |
| Tunnel URL times out (browser) | cloudflared process closed | Re-run `cloudflared tunnel --url http://localhost:3100` |
| `ragflow_chat` returns error | RAGflow Docker not running | Start RAGflow Docker, verify `http://127.0.0.1:9380` responds |
| `ERR Connection terminated` lines at exit | You pressed Ctrl+C | Normal — not an error |

---

## Architecture Reminder

```
Your Machine
  ├── Next.js app          → http://localhost:3000
  ├── MCP server           → http://localhost:3100
  │     ├── JWT auth + rate limiting
  │     └── bridges to RAGflow at http://127.0.0.1:9380
  └── cloudflared tunnel   → https://<random>.trycloudflare.com
                               (public HTTPS, Cloudflare CDN, HTTP/2)

Internet clients (Claude Desktop, Claude Code, API callers)
  → hit the trycloudflare.com URL
  → Cloudflare forwards to cloudflared on your machine
  → cloudflared forwards to MCP server on port 3100
  → MCP server validates JWT, rate-limits, calls RAGflow
  → RAGflow returns AI answer
```

---

## Quick Tunnel Limitations

Quick tunnels (no Cloudflare account) have some restrictions:

- URL changes every time you restart — not suitable for permanent production use
- No uptime guarantee from Cloudflare
- Subject to Cloudflare's Terms of Service

For production, set up a **named tunnel** with a fixed subdomain via [Cloudflare Zero Trust](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps). The MCP server code works identically — only the tunnel command changes.
