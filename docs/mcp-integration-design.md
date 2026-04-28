# Phase 2.2 — MCP Integration Design

**Date**: 2026-04-28  
**Branch**: `feature/mcp-integration`  
**Status**: Approved — proceeding to implementation

---

## Section 1: Current Interface Contract

### What `lib/ragflow.ts` returns

```typescript
callRagflow(messages: Message[]): Promise<ReadableStream<Uint8Array>>
```

- Calls RAGflow's OpenAI-compatible SSE endpoint directly
- Returns `response.body` — raw bytes of the SSE stream
- SSE format (OpenAI-compatible):
  ```
  data: {"choices":[{"delta":{"content":"token"}}]}\n\n
  data: {"choices":[{"delta":{"content":"more"}}]}\n\n
  data: [DONE]\n\n
  ```

### What `app/api/chat/route.ts` expects

- A `Promise<ReadableStream<Uint8Array>>` from `callRagflow()`
- Raw SSE bytes forwarded directly to the browser (no transformation)
- `parseSseLine(line)` used on accumulated buffer to extract tokens for DB save
- The stream format MUST be OpenAI-compatible so `parseSseLine` keeps working

---

## Section 2: Why MCP `tools/call` Breaks Streaming

`ragflow_chat` tool in `mcp-server/src/server.ts` does:

```typescript
let fullText = ''
for await (const token of streamChat(...)) {
  fullText += token     // ← accumulates ALL tokens
}
return { content: [{ type: 'text', text: fullText }] }  // ← one big chunk
```

Calling this via `tools/call` would:
1. Wait for the entire RAGflow response (10–30 seconds)
2. Return it as a single MCP JSON message
3. User sees nothing, then the full response appears — **streaming UX destroyed**

The MCP `tools/call` protocol is designed for Claude Desktop / Claude Code AI clients (Phase 2.1), not for real-time browser streaming.

---

## Section 3: Solution — `/relay` Endpoint on MCP Server

Add a `/relay` route to `mcp-server/src/index.ts` that:

1. Reuses the same JWT auth (`verifyToken`) and rate limiting (`checkRateLimit`) already in the request handler
2. Accepts `POST { messages: Message[], chat_id: string }` — same shape as `callRagflow()`
3. Calls RAGflow's OpenAI-compatible endpoint and streams tokens back
4. Returns the **same OpenAI-compatible SSE format** as the direct RAGflow call

```
POST /relay
Authorization: Bearer <jwt>
Content-Type: application/json

Body: { "messages": [...], "chat_id": "..." }

Response: text/event-stream (OpenAI-compatible SSE)
data: {"choices":[{"delta":{"content":"token"}}]}
...
data: [DONE]
```

This means `parseSseLine` in `route.ts` still works unchanged — **zero format change**.

---

## Section 4: `lib/mcp-client.ts` Design

```typescript
// Drop-in replacement for callRagflow() in lib/ragflow.ts
export async function callMcpRelay(messages: Message[]): Promise<ReadableStream<Uint8Array>>
```

- Reads `MCP_SERVER_URL`, `MCP_JWT_TOKEN`, `MCP_CHAT_ID` from env
- Posts to `${MCP_SERVER_URL}/relay`
- Returns `response.body` directly — same shape as `callRagflow()` return value
- Re-exports `parseSseLine` from `./ragflow` so route.ts import change is minimal

Error handling:
- `401` / `403` from MCP server → throw (route.ts catches → 502)
- `429` from MCP server → throw with `rate_limited` message (route.ts catches → 502, upstream limit)
- network error → throw (route.ts catches → 502)
- empty body → throw

---

## Section 5: Changes to `app/api/chat/route.ts`

Exactly 2 line changes:

```typescript
// Before:
import { callRagflow, parseSseLine, type Message } from '@/lib/ragflow'
// ...
ragflowStream = await callRagflow(sanitizedMessages)

// After:
// LEGACY RAGFLOW DIRECT: import { callRagflow, parseSseLine, type Message } from '@/lib/ragflow'
import { callMcpRelay, parseSseLine, type Message } from '@/lib/mcp-client'
// ...
// LEGACY RAGFLOW DIRECT: ragflowStream = await callRagflow(sanitizedMessages)
ragflowStream = await callMcpRelay(sanitizedMessages)
```

Everything else — auth, rate limiting, streaming loop, DB save, timeouts — unchanged.

---

## Section 6: Environment Variables

### New vars (`.env.local`)
```bash
MCP_SERVER_URL=http://localhost:3100       # or https://xxx.trycloudflare.com when tunnel active
MCP_JWT_TOKEN=<from: cd mcp-server && npm run generate-token>
MCP_CHAT_ID=018eddce030f11f182236a518a4f7571   # same as RAGFLOW_CHAT_ID
```

### Existing vars — now MCP server side only
```bash
# No longer used by Next.js app — used by mcp-server/.env only
RAGFLOW_BASE_URL=http://127.0.0.1:9380
RAGFLOW_API_KEY=...
```

---

## Section 7: Fallback Strategy

`lib/ragflow.ts` is kept intact with `// LEGACY RAGFLOW DIRECT:` markers on usage sites.

To rollback Phase 2.2 in 30 seconds:
1. In `route.ts`: uncomment the two `// LEGACY RAGFLOW DIRECT:` lines, comment the new import/call
2. Remove `MCP_SERVER_URL` / `MCP_JWT_TOKEN` from `.env.local`
3. Restart Next.js — back to direct RAGflow

---

## Section 8: Testing Strategy

1. **Unit** (`vitest`): `lib/mcp-client.ts` — mocked fetch, correct headers, error propagation
2. **Integration**: Start MCP server locally → call `/relay` → verify SSE stream
3. **E2E** (`playwright`): Chat UI → send message → verify streaming renders progressively

Architecture of test:
- MCP server on `localhost:3100` (no Cloudflare tunnel needed for CI)
- `MCP_SERVER_URL=http://localhost:3100` in test env
- Cloudflare tunnel = transport only; same code, different URL

---

## Data Flow Diagram (After)

```
Browser
  │  SSE stream (unchanged)
  ▼
app/api/chat/route.ts
  │  POST /relay  (JWT auth header)
  ▼
MCP Server (port 3100)
  │  JWT verify → rate limit → stream proxy
  │  POST /api/v1/chats_openai/{id}/chat/completions
  ▼
RAGflow Docker (port 9380)
  │  SSE (OpenAI-compatible)
  ▼
MCP Server → streams back OpenAI SSE
  ▼
route.ts → forwards raw bytes to browser
  ▼
Browser renders tokens progressively
```
