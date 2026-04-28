# MCP Server — Local Machine (Phase 2.1)

**Status**: Verified working 2026-04-28  
**Phase**: 2.1 — Local proof-of-concept  

---

## Start Commands

### 1. Start MCP Server

```bash
cd mcp-server
npm start
```

Server listens on `http://localhost:3100`. Log output confirms:
```
{"level":"info","msg":"MCP server listening","port":3100}
```

### 2. Start Cloudflare Quick Tunnel

> **Important**: Use `--protocol http2` — QUIC (default) is blocked on this network's firewall.

```bash
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --protocol http2 --url http://localhost:3100
```

Wait for:
1. `Your quick Tunnel has been created!` — shows the public URL
2. `Registered tunnel connection connIndex=0` — tunnel is live

The URL changes each session (e.g. `https://some-words.trycloudflare.com`).

---

## Generate a Token

```bash
cd mcp-server
npm run generate-token
```

Optional args: `npm run generate-token -- my-client-name 7d` (custom sub + expiry)

---

## Claude Code MCP Config

Add to `~/.claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bamboo-vet": {
      "url": "https://YOUR-TUNNEL-URL.trycloudflare.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN"
      }
    }
  }
}
```

---

## E2E Verification (curl)

Replace `$URL` and `$TOKEN` with your values.

```bash
# 1. No auth → must return 401
curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# 2. Valid auth + ping → SSE: {"result":{},"jsonrpc":"2.0","id":1}
curl -s \
  -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'

# 3. List available RAGflow chat assistants
curl -s \
  -X POST "$URL/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"ragflow_list_chats","arguments":{}}}'
```

---

## Known Behaviour

| Observation | Explanation |
|---|---|
| `X-Accel-Buffering: no` absent in tunnel responses | Cloudflare strips this upstream header; it's set correctly on the origin |
| URL changes each tunnel restart | Quick Tunnel limitation — Phase 2.3 will use a named tunnel with stable domain |
| QUIC protocol fails (UDP blocked) | Use `--protocol http2` flag always |

---

## Environment Variables (`.env`)

```bash
RAGFLOW_BASE_URL=http://127.0.0.1
RAGFLOW_API_KEY=<from main project .env.local>
MCP_PORT=3100
MCP_JWT_SECRET=<min 32 chars random secret>
CLOUDFLARE_TUNNEL_URL=<fill after tunnel starts>
```
