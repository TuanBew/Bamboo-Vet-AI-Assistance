# RAGflow MCP Server

Standalone MCP (Model Context Protocol) server that proxies the local RAGflow Docker instance, exposed publicly via Cloudflare Tunnel with JWT authentication.

## Architecture

```
Internet (HTTPS via Cloudflare Quick Tunnel)
    │
cloudflared --url http://localhost:3100
    │
MCP Server (Node.js, port 3100)
  JWT Bearer auth + in-memory rate limiting (60 req/min)
    │
RAGflow (Docker, http://127.0.0.1)
```

## Prerequisites

- Node.js 20+
- RAGflow running in Docker on `http://127.0.0.1`
- `cloudflared` CLI (for tunnel — see Setup step 5)

## Setup

### 1. Install dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

| Variable | Description |
|---|---|
| `RAGFLOW_BASE_URL` | RAGflow Docker URL (default: `http://127.0.0.1`) |
| `RAGFLOW_API_KEY` | Your RAGflow API key |
| `MCP_PORT` | Port for this server (default: `3100`) |
| `MCP_JWT_SECRET` | JWT signing secret — generate with the command below |
| `CLOUDFLARE_TUNNEL_URL` | Set after running the tunnel (step 5) |

Generate a strong JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Generate a client token

```bash
npm run generate-token
```

Copy the printed token. Clients send it as `Authorization: Bearer <token>`. Default expiry: 30 days.

To generate a token for a specific client with custom expiry:

```bash
npm run generate-token my-client-name 7d
```

### 4. Start the MCP server

```bash
npm start
```

Expected log: `{"level":"info","msg":"MCP server listening","port":3100,...}`

### 5. Start Cloudflare Quick Tunnel

Install `cloudflared` (Windows):

```bash
winget install Cloudflare.cloudflared
```

Start a free temporary tunnel (no account required):

```bash
cloudflared tunnel --url http://localhost:3100
```

Copy the `https://<random>.trycloudflare.com` URL from the output. Update `CLOUDFLARE_TUNNEL_URL` in `.env`.

## Available MCP Tools

| Tool | Description | Required params |
|---|---|---|
| `ragflow_chat` | Send a message to RAGflow and get a response | `message`, `chat_id` |
| `ragflow_list_chats` | List available RAGflow chat assistants | none |

## Running Tests

```bash
npm test
```

All 21 tests must pass (auth, rate limiter, RAGflow client, integration).

## Security

- All requests require a valid JWT Bearer token — unauthenticated requests return 401
- Rate limited to 60 requests/minute per token
- `MCP_JWT_SECRET` and `RAGFLOW_API_KEY` are never logged or returned in responses
- `X-Accel-Buffering: no` set on all responses to prevent Cloudflare stream buffering

## Connecting from Claude Code

After the tunnel is running, add to Claude Code's MCP config:

```json
{
  "mcpServers": {
    "ragflow": {
      "url": "https://<your-tunnel>.trycloudflare.com",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

## Phase Roadmap

| Phase | Status |
|---|---|
| 2.1 — Local machine test (this) | ✅ |
| 2.2 — App integration | Pending |
| 2.3 — Company server deployment | Pending |
