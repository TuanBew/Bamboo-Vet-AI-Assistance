# RAGflow MCP Server

Standalone [Model Context Protocol](https://modelcontextprotocol.io/) HTTP server that proxies a local RAGflow Docker instance, exposed publicly via an ngrok tunnel with JWT authentication.

## Architecture

```
Internet (HTTPS via ngrok tunnel)
    │
ngrok http 3100
    │
MCP Server (Node.js, port 3100)
  JWT Bearer auth + in-memory rate limiting (60 req/min)
    │         │
    │    /relay — OpenAI-compatible SSE stream (Next.js app integration)
    │
RAGflow (Docker, http://127.0.0.1)
```

## Prerequisites

- Node.js 20+
- RAGflow running locally in Docker
- [ngrok](https://ngrok.com) installed and authenticated (`ngrok config add-authtoken <token>`)

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

### 4. Start MCP server + tunnel

**Windows (recommended) — one command:**

```powershell
.\start-tunnel.ps1
```

This script:
1. Kills any existing process on port 3100
2. Starts the MCP server in a new window (`npm start`)
3. Launches the ngrok tunnel
4. Prints the public HTTPS URL and the `.env.local` line to copy

**Manual start (any OS):**

```bash
# Terminal 1 — MCP server
npm start

# Terminal 2 — ngrok tunnel
ngrok http 3100
```

After the tunnel is running, update `MCP_SERVER_URL` in the Next.js `.env.local`:

```
MCP_SERVER_URL=https://<random>.ngrok-free.app
```

Then restart the Next.js dev server.

## Available MCP Tools

These tools are exposed to MCP clients (Claude Desktop, Claude Code, etc.):

| Tool | Description | Required params |
|---|---|---|
| `ragflow_chat` | Send a message to RAGflow and stream a response | `message`, `chat_id` |
| `ragflow_list_chats` | List available RAGflow chat assistants | none |

The server also exposes a `/relay` HTTP endpoint for the Next.js app integration — it accepts `{ messages, chat_id }` and returns an OpenAI-compatible SSE stream.

## Running Tests

```bash
npm test
```

All 21 tests must pass (auth, rate limiter, RAGflow client, integration).

## Security

- All requests require a valid JWT Bearer token — unauthenticated requests return 401
- Rate limited to 60 requests/minute per token
- `MCP_JWT_SECRET` and `RAGFLOW_API_KEY` are never logged or returned in responses
- `X-Accel-Buffering: no` set on all responses to prevent proxy stream buffering

## Connecting from Claude Code / Claude Desktop

After the tunnel is running, add to your MCP client config:

```json
{
  "mcpServers": {
    "ragflow": {
      "url": "https://<your-ngrok-url>",
      "headers": {
        "Authorization": "Bearer <your-token>"
      }
    }
  }
}
```

Replace `<your-ngrok-url>` with the URL printed by `start-tunnel.ps1` or from the ngrok dashboard at `http://localhost:4040`.
