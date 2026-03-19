# Local Development Guide — Bamboo Vet AI Assistance

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- [RAGflow](https://github.com/infiniflow/ragflow) running locally
- A [Supabase](https://supabase.com) project
- An [Upstash Redis](https://upstash.com) database

---

## 1. Clone and Install

```bash
git clone https://github.com/TuanBew/Bamboo-Vet-AI-Assistance.git
cd Bamboo-Vet-AI-Assistance
npm install
```

---

## 2. Environment Variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

# RAGflow (local)
RAGFLOW_BASE_URL=http://127.0.0.1:9380
RAGFLOW_API_KEY=<your-ragflow-api-key>
RAGFLOW_CHAT_ID=<your-chat-assistant-id>

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

**Where to find each value:**

| Variable | Location |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → `service_role` key |
| `RAGFLOW_BASE_URL` | URL of your RAGflow instance (default: `http://127.0.0.1:9380`) |
| `RAGFLOW_API_KEY` | RAGflow → top-right avatar → API Key |
| `RAGFLOW_CHAT_ID` | RAGflow → Chat Assistant → URL contains the ID |
| `UPSTASH_REDIS_REST_URL` | Upstash console → your database → REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → your database → REST Token |

---

## 3. Set Up Supabase Database

1. Go to your Supabase project → **SQL Editor**
2. Open `supabase/schema.sql` from this repository
3. Paste the full contents and click **Run**

This creates:
- `conversations` table with RLS policies
- `messages` table with RLS policies
- Indexes and `updated_at` trigger

---

## 4. Supabase Auth Configuration

### Disable email confirmation (recommended for development)

1. Supabase → **Authentication → Providers → Email**
2. Toggle **"Confirm email"** → **OFF**
3. Save

This allows users to log in immediately after signing up without needing to confirm their email.

### Site URL

1. Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to `http://localhost:3000`
3. Add `http://localhost:3000/**` to **Redirect URLs**

---

## 5. Start RAGflow

Make sure RAGflow is running and accessible at `http://127.0.0.1:9380` (or whatever you set as `RAGFLOW_BASE_URL`).

You can verify it's running by opening that URL in your browser — the RAGflow dashboard should appear.

---

## 6. Run the Development Server

```bash
npm run dev
```

The app will be available at **http://localhost:3000**

---

## 7. Test the App

| URL | What to test |
|-----|-------------|
| `http://localhost:3000` | Landing page |
| `http://localhost:3000/chat` | Guest chat (no login required) |
| `http://localhost:3000/signup` | Create an account |
| `http://localhost:3000/login` | Log in |
| `http://localhost:3000/app` | Authenticated app (redirects to login if not signed in) |

**Full flow test:**
1. Visit `/signup` → create an account → should auto-redirect to `/app`
2. Click **"Cuộc trò chuyện mới"** (New conversation)
3. Type a veterinary question, e.g. `Liều amoxicillin cho chó 10kg?`
4. Response should stream token by token from RAGflow
5. Refresh the page — conversation history should reload from Supabase
6. Test rename and delete from the sidebar
7. Toggle **VI / EN** language in the header

---

## Troubleshooting

**`Module not found` errors**
```bash
npm install
```

**`next.config.js` ES module error**
The config uses `export default` (ESM). Make sure `package.json` has `"type": "module"`.

**RAGflow not responding**
- Verify RAGflow is running: open `http://127.0.0.1:9380` in your browser
- Check `RAGFLOW_BASE_URL` in `.env.local` matches the actual port
- RAGflow binds to `0.0.0.0` but connect to it via `127.0.0.1`

**Signup redirects to `/login` instead of `/app`**
Supabase email confirmation is enabled. Disable it in Supabase → Authentication → Providers → Email → "Confirm email" OFF.

**Login shows "Email chưa được xác nhận"**
Same cause as above — email confirmation is on. Either confirm the email from the Supabase dashboard (Authentication → Users) or disable email confirmation.

**Port 3000 in use**
Next.js will automatically use port 3001. Update your Supabase Site URL accordingly.
