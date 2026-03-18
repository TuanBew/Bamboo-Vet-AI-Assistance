---
status: complete
phase: 02-admin-shell-role-based-routing
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md]
started: 2026-03-18T14:00:00Z
updated: 2026-03-18T14:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Admin route guard — logged-out redirect
expected: Visit /admin/dashboard while not logged in → redirected to login page, no admin content shown
result: pass

### 2. Admin route guard — non-admin blocked
expected: Log in as a regular user (non-admin, is_admin = false) and visit /admin/dashboard → redirected away, NOT shown admin layout
result: pass

### 3. Admin route guard — admin access granted
expected: Log in as an admin user (is_admin = true) and visit /admin/dashboard → admin layout renders, no redirect
result: pass

### 4. Admin-to-app redirect
expected: While logged in as admin, visit /app → automatically redirected to /admin/dashboard
result: pass

### 5. Dark admin layout renders
expected: On any /admin/* page, a dark-themed layout is visible: dark background, 240px sidebar on the left, top bar across the top
result: pass

### 6. Sidebar sections and navigation
expected: Sidebar shows 3 labeled sections (CORE, CHECKED, OTHER) with nav items. Clicking a nav item navigates to the correct route.
result: pass

### 7. Top bar breadcrumb and actions
expected: Top bar shows current page name as breadcrumb, a Refresh button, and a Sign Out button
result: pass

### 8. Settings page — profile and admin badge
expected: /admin/settings shows admin name, email, "Admin" role badge, and last refreshed timestamp
result: pass

### 9. Refresh button works
expected: Clicking Refresh triggers materialized view refresh; timestamp updates with no crash
result: pass

### 10. KpiCard renders correctly
expected: KpiCard renders a colored card with value, label, and optional icon
result: skipped
reason: Not yet used on any page (dashboard is placeholder); will be testable in Phase 3

### 11. SectionHeader toggle
expected: SectionHeader renders with chevron, collapses/expands on click
result: skipped
reason: Not yet used on any page; will be testable in Phase 3

## Summary

total: 11
passed: 9
issues: 0
pending: 0
skipped: 2

## Gaps

[none]
