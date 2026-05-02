# Docker Update Workflow

How to deploy code updates or configuration changes to the company server.

---

## Updating the application code

### On the development machine

1. Make and test your changes locally
2. Run `npm run test:all` to confirm all tests pass
3. Run `npm run test:docker` to verify the Docker stack is still green
4. Commit to `feature/docker-selfhost` (or merge to `main`)
5. ZIP the project folder:
   ```powershell
   Compress-Archive -Path "D:\...\bamboo-docker\*" -DestinationPath bamboo-vet-update.zip
   ```
   The `.env` file is gitignored and will **not** be included — the company server keeps its own `.env`.

### On the company server

1. Copy the ZIP to the server and extract to a **temporary folder**:
   ```powershell
   Expand-Archive -Path bamboo-vet-update.zip -DestinationPath C:\bamboo-vet-tmp
   ```
2. Verify the new `.env.example` has no new required variables vs the current `.env`:
   ```powershell
   # Check for new keys not yet in your .env
   Compare-Object (Get-Content C:\bamboo-vet-tmp\.env.example | Where-Object { $_ -match '^[A-Z]' } | ForEach-Object { ($_ -split '=')[0] }) `
                  (Get-Content C:\bamboo-vet-ai\.env | Where-Object { $_ -match '^[A-Z]' } | ForEach-Object { ($_ -split '=')[0] })
   ```
   If new keys appear, add them to your `.env` with real values before proceeding.
3. Copy updated files over (preserving your `.env`):
   ```powershell
   $exclude = @('.env', '.git', 'node_modules', '.next')
   Get-ChildItem C:\bamboo-vet-tmp | Where-Object { $_.Name -notin $exclude } | 
       Copy-Item -Destination C:\bamboo-vet-ai -Recurse -Force
   ```
4. Re-deploy:
   ```powershell
   cd C:\bamboo-vet-ai
   .\deploy.ps1
   ```

`deploy.ps1` runs all pre-flight checks and then calls `docker compose up -d --build`.
Docker only rebuilds layers that changed — unchanged layers hit the cache, so re-deploys are fast (~60-90s typically).

---

## Changing .env values only (no code changes)

If you only changed a secret or config value in `.env`:

```powershell
cd C:\bamboo-vet-ai
# Edit .env with your changes, then:
.\deploy.ps1
```

`docker compose up -d --build` recreates containers with the new env values even when the image hasn't changed.

---

## Rollback procedure

Docker keeps the previous image layer cache, but if you need to roll back to a specific commit:

1. On the development machine, check out the previous commit:
   ```bash
   git checkout <previous-commit-sha>
   ```
2. ZIP and copy to the server as in the update workflow above
3. Run `.\deploy.ps1`

> The DuckDNS `DOMAIN` and `DUCKDNS_TOKEN` in `.env` never change between versions — only the application code changes.

---

## Renewing the MCP JWT token manually

`deploy.ps1` auto-generates a 365-day token on every run. If the token expires before then:

```powershell
cd C:\bamboo-vet-ai
.\deploy.ps1    # regenerates the token, restarts the stack
```

Or generate manually (requires node.js on the host):
```powershell
$secret = (Get-Content .env | Where-Object { $_ -match '^MCP_JWT_SECRET=' }) -replace 'MCP_JWT_SECRET=',''
node -e "const c=require('crypto'),h=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),n=Math.floor(Date.now()/1000),p=Buffer.from(JSON.stringify({sub:'app-nextjs',iat:n,exp:n+31536000})).toString('base64url'),s=c.createHmac('sha256','$secret').update(h+'.'+p).digest('base64url');console.log(h+'.'+p+'.'+s);"
# Copy the output and set MCP_JWT_TOKEN=<output> in .env
# Then: docker compose up -d (no rebuild needed for env-only changes)
```

---

## Stopping and starting the stack

```powershell
docker compose stop      # graceful stop (preserves containers and volumes)
docker compose start     # restart stopped containers without rebuild
docker compose down      # remove containers (volumes preserved)
docker compose up -d     # start without rebuild
```

The `caddy_data` volume stores the Let's Encrypt certificate and persists across `docker compose down/up`. Only `--volumes` removes it (forces fresh cert on next start).

---

## Monitoring

```powershell
# Live log stream
docker compose logs -f

# Resource usage
docker stats --no-stream

# Container health
docker compose ps
```
