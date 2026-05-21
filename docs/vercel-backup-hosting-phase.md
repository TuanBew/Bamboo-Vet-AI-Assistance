# Vercel Backup Hosting Phase

## Purpose

This phase restores Bamboo Vet to a public Vercel production path while keeping the company MySQL server protected. Vercel serves the Next.js app, reads admin analytics from a hosted read-only backup MySQL database, and sends chat traffic through an authenticated MCP relay to local RAGflow.

Production URL:

```text
https://bamboo-vet-ai.vercel.app
```

## Runtime architecture

```text
Browser
  -> https://bamboo-vet-ai.vercel.app
    -> Next.js on Vercel
      -> /api/admin/* -> hosted read-only backup MySQL
      -> /api/ai-analysis -> hosted read-only backup MySQL + Gemini
      -> /api/chat -> public MCP HTTPS tunnel -> local MCP server -> local RAGflow
      -> /api/conversations -> Supabase
```

The important split is that admin and analytics pages do not depend on MCP or RAGflow. MCP only serves the chat path. If chat is down but the dashboard loads, debug the MCP/RAGflow chain rather than the backup MySQL path.

## Backup MySQL mode

Vercel production should run with backup database settings, not direct company MySQL credentials.

Required production environment variables:

```env
MYSQL_MODE=backup
BACKUP_MYSQL_HOST=<hosted-backup-host>
BACKUP_MYSQL_PORT=3306
BACKUP_MYSQL_DATABASE=<backup-database>
BACKUP_MYSQL_USER=<readonly-user>
BACKUP_MYSQL_PASSWORD=<readonly-password>
BACKUP_MYSQL_SSL=true
```

The backup user must be read-only. Do not put SQL dumps or company MySQL credentials in git.

## RAGflow MCP setup

The MCP server lives in `mcp-server/` and exposes a small authenticated relay:

```text
POST /relay
GET /health
```

Local MCP environment requirements:

```env
MCP_JWT_SECRET=<local-relay-signing-secret>
RAGFLOW_BASE_URL=http://127.0.0.1
RAGFLOW_API_KEY=<valid-local-ragflow-api-key>
RAGFLOW_CHAT_ID=<ragflow-dialog-id-owned-by-that-key>
```

Run the local stack:

```powershell
docker ps
npm --prefix mcp-server start
```

RAGflow was reachable locally on port 80, so MCP uses `RAGFLOW_BASE_URL=http://127.0.0.1`. In this phase, port 9380 was not the working HTTP entrypoint.

## Exposing MCP to Vercel

Vercel cannot call `localhost`, so the local MCP server must be exposed through a public HTTPS tunnel. During verification this used ngrok:

```powershell
ngrok http 3100
```

The public HTTPS tunnel URL becomes Vercel's `MCP_SERVER_URL`.

Vercel production chat variables:

```env
MCP_SERVER_URL=https://<public-mcp-tunnel-or-domain>
MCP_JWT_TOKEN=<jwt-signed-with-MCP_JWT_SECRET>
MCP_CHAT_ID=<same-valid-ragflow-dialog-id>
```

After changing any Vercel production env var, redeploy production so serverless functions receive the new values:

```powershell
vercel env rm MCP_SERVER_URL production --yes
"https://<public-mcp-tunnel-or-domain>" | vercel env add MCP_SERVER_URL production
vercel env rm MCP_JWT_TOKEN production --yes
"<token>" | vercel env add MCP_JWT_TOKEN production
vercel env rm MCP_CHAT_ID production --yes
"<dialog-id>" | vercel env add MCP_CHAT_ID production
vercel deploy --prod --yes
```

Do not print real tokens in logs or docs.

## How another developer can use the MCP relay

A developer needs three things:

1. The public MCP URL.
2. A valid bearer token signed with the MCP server secret.
3. A RAGflow dialog ID that belongs to the configured RAGflow API key.

Health check:

```powershell
Invoke-WebRequest -Uri "https://<public-mcp-url>/health" -UseBasicParsing
```

Relay request shape:

```http
POST https://<public-mcp-url>/relay
Authorization: Bearer <mcp-jwt-token>
Content-Type: application/json

{
  "chat_id": "<ragflow-dialog-id>",
  "messages": [
    { "role": "user", "content": "Xin chào" }
  ]
}
```

Expected result is a streamed RAGflow response. A `401` or `403` points to the MCP token. A `502` from `/api/chat` usually means Vercel could not complete the MCP/RAGflow chain. A `200` with an empty or error-like assistant response can mean RAGflow accepted the HTTP request but rejected the API key or chat ownership.

## Verification performed

Production was verified through the real domain and browser UI:

- Vercel production alias points to `https://bamboo-vet-ai.vercel.app`.
- `npm test` passed with 32 test files and 266 tests.
- Browser loaded the production domain and authenticated admin dashboard.
- Browser opened `/app`, sent `Xin chào`, and received a Vietnamese assistant response.
- Network showed `POST /api/chat` returning `200`.
- MCP logs showed `sub=vercel-production-chat` calling `/relay`.
- Vercel runtime error scan found no production errors for the checked window.

## Operational notes

- Use a stable MCP HTTPS hostname for production. A temporary ngrok URL works for validation but should be replaced with a reserved ngrok domain, Cloudflare Tunnel hostname, or hosted MCP endpoint.
- If the tunnel URL changes, update `MCP_SERVER_URL` in Vercel and redeploy.
- If RAGflow is restarted from a different data volume, confirm the API key and dialog ID still match.
- Keep the company MySQL path read-only and separate from the Vercel hosted-backup database path.
