# Performance Verification Checklist

## Prerequisites
- Dev server running: `npm run dev`
- Browser: Chrome with DevTools open

## Test 1: Server Stability (30+ minutes)

1. Start fresh dev server: `npm run dev`
2. Open admin dashboard: http://localhost:3000/admin/dashboard
3. Navigate through all admin pages every 5 minutes:
   - /admin/dashboard
   - /admin/check-users
   - /admin/check-clinics
   - /admin/check-customers
   - /admin/check-distributor
   - /admin/khach-hang
   - /admin/nhap-hang
   - /admin/ton-kho
4. After 30 minutes, check:
   - [ ] Server still responsive (no 60s timeouts)
   - [ ] Pages load without errors
   - [ ] No crash in terminal

## Test 2: Page Load Times (<3s target)

Using Chrome DevTools Network tab (disable cache):

| Page | Target | Actual | Pass? |
|------|--------|--------|-------|
| /admin/dashboard | <3s | ___s | [ ] |
| /admin/check-users | <3s | ___s | [ ] |
| /admin/check-clinics | <3s | ___s | [ ] |
| /admin/check-customers | <3s | ___s | [ ] |
| /admin/check-distributor | <3s | ___s | [ ] |
| /admin/khach-hang | <3s | ___s | [ ] |
| /admin/nhap-hang | <3s | ___s | [ ] |
| /admin/ton-kho | <3s | ___s | [ ] |

## Test 3: Concurrent Page Loads

1. Open 4 admin pages simultaneously in separate tabs
2. Check:
   - [ ] All 4 pages load successfully
   - [ ] No server errors in terminal
   - [ ] No connection timeouts

## Test 4: Connection Leak Check

After 30 minutes of testing, run in a terminal:
```bash
# Windows
netstat -an | findstr :3000 | findstr CLOSE_WAIT
# Linux/Mac
netstat -an | grep :3000 | grep CLOSE_WAIT
```

- [ ] No CLOSE_WAIT connections accumulated (0 expected)

## Test 5: Browser Cache Hits

1. Load any admin page
2. Reload the same page
3. Check DevTools Network tab:
   - [ ] Static assets show "(from disk cache)" or "(from memory cache)"
   - [ ] JS/CSS bundles cached on repeat visits

## Automated Audit

Run the automated audit:
```bash
npx tsx scripts/perf-audit.ts
```

- [ ] 0 failures in audit output
- [ ] SSE streaming: all 7 checks pass
- [ ] Memoization: no critical components missing useMemo
