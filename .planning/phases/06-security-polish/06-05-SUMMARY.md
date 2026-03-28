---
phase: 06-security-polish
plan: 05
subsystem: database
tags: [seed-data, generators, deterministic, typescript, vietnamese]

# Dependency graph
requires:
  - phase: 01-database-migrations-seed-data
    provides: "Database schema (profiles, conversations, messages, query_events tables)"
provides:
  - "Deterministic profile generator (132 users, 28 provinces)"
  - "Deterministic conversation generator (10,440 conversations, non-linear growth curve)"
  - "Deterministic message generator (52,194 messages, user/assistant alternating)"
  - "Deterministic chat_analytics generator (1:1 with conversations)"
  - "Deterministic query_events generator (1:1 with conversations, matches DB schema)"
affects: [seed-data, dashboard-verification, analytics]

# Tech tracking
tech-stack:
  added: []
  patterns: [deterministic-seed-generators, detHash-sin-pattern, deterministicHash-string-pattern]

key-files:
  created:
    - data/seeds/profiles.ts
    - data/seeds/conversations.ts
    - data/seeds/messages.ts
    - data/seeds/chat_analytics.ts
    - data/seeds/query_events.ts

key-decisions:
  - "Scaled growth curve 2x from plan spec to reach 10K-12K conversations target"
  - "Query events generator matches actual DB schema (clinic_id, drug_category, response_time_ms) not plan's assumed schema (province, clinic_type, year, month, day)"
  - "Chat analytics generator created despite no chat_analytics table in DB -- serves as classification layer for future use"

patterns-established:
  - "Seed generator pattern: export function generateX() returning typed array with deterministic hash"
  - "Conversation _drug_group/_animal_type fields propagate to downstream generators for consistency"

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-03-28
---

# Phase 06 Plan 05: Seed Data Expansion Summary

**5 deterministic TypeScript generators producing 132 profiles, 10K conversations, 52K messages with Vietnamese veterinary content and non-linear growth curve**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-28T14:16:21Z
- **Completed:** 2026-03-28T14:24:54Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Profile generator: 132 users (130 non-admin + 2 admin) across 28 Vietnamese provinces with realistic lat/lng coordinates
- Conversation generator: 10,440 conversations following non-linear growth curve (120-200/mo in 2024, 700-900/mo at 2025 Q3-Q4 peak, 350-500/mo in 2026 Q1)
- Message generator: 52,194 messages with alternating user/assistant roles, Vietnamese veterinary content templates
- Chat analytics and query events generators: 1:1 mapping with conversations, proper drug/animal/query type distributions
- All generators fully deterministic -- identical output on repeated runs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create profile and conversation generators** - `6963fb1e` (feat)
2. **Task 2: Create message, chat_analytics, and query_events generators** - `fe59568e` (feat)

## Files Created/Modified
- `data/seeds/profiles.ts` - Deterministic profile generator (132 users, 28 provinces, Vietnamese names)
- `data/seeds/conversations.ts` - Deterministic conversation generator (10,440 conversations, non-linear growth)
- `data/seeds/messages.ts` - Deterministic message generator (52,194 messages, user/assistant alternating)
- `data/seeds/chat_analytics.ts` - Deterministic chat analytics generator (1:1 with conversations)
- `data/seeds/query_events.ts` - Deterministic query events generator (1:1 with conversations, matches DB schema)

## Decisions Made
- Scaled growth curve base values 2x from plan spec (plan's curve totaled ~5K, needed ~10K-12K)
- Adapted query_events generator to match actual DB schema (uses clinic_id, drug_category, response_time_ms) rather than plan's assumed schema (province, clinic_type, year, month, day)
- Created chat_analytics generator despite no corresponding DB table -- useful as classification data source for query_events or future schema additions
- Message count per conversation uses 2-8 range (even numbers only) to ensure conversations always end with assistant response

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed conversation volume to reach 10K-12K target**
- **Found during:** Task 1 (conversation generator)
- **Issue:** Plan's growth curve formula produced only ~5,300 conversations total
- **Fix:** Doubled base values in monthlyVolume function (120-200, 300-500, 700-900, 350-500)
- **Files modified:** data/seeds/conversations.ts
- **Verification:** Generator now produces 10,440 conversations
- **Committed in:** 6963fb1e (Task 1 commit)

**2. [Rule 1 - Bug] Fixed message role alternation ending on user instead of assistant**
- **Found during:** Task 2 (message generator)
- **Issue:** Odd message counts caused last message to be 'user' role instead of 'assistant'
- **Fix:** Adjusted msgCount to produce even numbers (2-8) so last index is always odd (assistant)
- **Files modified:** data/seeds/messages.ts
- **Verification:** All conversations verified to end with assistant role
- **Committed in:** fe59568e (Task 2 commit)

**3. [Rule 3 - Blocking] Adapted query_events schema to match actual DB**
- **Found during:** Task 2 (query_events generator)
- **Issue:** Plan specified schema with province/clinic_type/year/month/day columns, but actual DB has clinic_id/drug_category/response_time_ms
- **Fix:** Generated query_events matching actual migration schema
- **Files modified:** data/seeds/query_events.ts
- **Verification:** Fields match 20260318_003_create_query_events.sql migration
- **Committed in:** fe59568e (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness and schema compatibility. No scope creep.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 generator files ready for integration into seed script
- Generators can replace markdown-based seed files when seed.ts is updated to use them
- Growth curve data suitable for verifying all dashboard visualizations

---
*Phase: 06-security-polish*
*Completed: 2026-03-28*
