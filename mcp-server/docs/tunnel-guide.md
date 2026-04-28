# Tunnel Guide — MCP Server

## Quick Start

```powershell
cd mcp-server
.\start-tunnel.ps1
```

The script starts the MCP server and tunnel together, prints the public HTTPS URL automatically.

## What the Script Does

1. Kills any existing process on port 3100
2. Kills any existing ngrok process
3. Starts the MCP server (`npm start`) in a new window
4. Waits 5 seconds, verifies port 3100 is listening
5. Starts `ngrok http 3100`
6. Queries the ngrok local API (`http://localhost:4040/api/tunnels`) and prints the public HTTPS URL

## After the Script Runs

Copy the printed URL and set it in `.env.local`:

```
MCP_SERVER_URL=https://xxxx.ngrok-free.app
```

Then restart the Next.js dev server so it picks up the new env var.

**Note:** The ngrok free plan gives a new URL on every `ngrok` restart. Update `.env.local` each time you run the script.

## Why ngrok Instead of Cloudflare Tunnel

cloudflared quick tunnels use QUIC (UDP/443) or HTTP/2 (TCP/7844). On networks that block UDP egress and non-standard TCP ports (common on corporate/ISP firewalls), both protocols time out and cloudflared has no fallback to TCP/443.

ngrok always uses standard TCP/443 for its control plane, which works on any network.

## Requirements

- ngrok installed: `winget install ngrok.ngrok`
- Auth token configured: `ngrok config add-authtoken <token>` (free account at ngrok.com)
- ngrok version ≥ 3.20.0: run `ngrok update` if needed

## Verifying the Tunnel Works

After the script runs, confirm the relay endpoint is reachable:

```powershell
$token = $env:MCP_JWT_TOKEN  # or paste the token from .env.local
Invoke-WebRequest `
    -Uri "https://YOUR-URL.ngrok-free.app/relay" `
    -Method POST `
    -Headers @{ "Authorization" = "Bearer $token"; "Content-Type" = "application/json" } `
    -Body '{"messages":[{"role":"user","content":"test"}],"chat_id":"YOUR_CHAT_ID"}'
```

Expected: HTTP 200, `Content-Type: text/event-stream`, OpenAI SSE lines.
