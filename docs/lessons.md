# Lessons Learned

## 2026-04-12: Upstream Merge + Container Deployment

### 1. Upstream Merge Strategy

**Rule:** When merging upstream with significant local modifications, use `--ours` (local priority) for conflict files only when the local changes are irreplaceable. For infrastructure files (go.mod, package.json, pnpm-lock.yaml), prefer upstream versions and re-apply local additions.

**Why:** Local go.mod lacked new upstream dependencies (google/uuid, bluemonday), causing backend build failures. Local pnpm-lock.yaml was stale after merge.

**How to apply:** After merge, always verify:
1. `go.mod` — use upstream, then `go get` any local additions (e.g., `golang.org/x/crypto` for bcrypt)
2. `pnpm-lock.yaml` — use upstream, then `pnpm install --no-frozen-lockfile`
3. Server handler files — if upstream restructured, use upstream as base and add local endpoints on top

### 2. Frontend Package Structure Migration

**Rule:** When upstream restructures from flat `@/features/auth` to monorepo `@multica/core/auth`, update local pages to use new imports. Do not keep old import paths.

**Why:** Upstream moved from `apps/web/features/` + `apps/web/shared/` to `packages/core/`, `packages/views/`, `packages/ui/`. Old paths don't exist anymore.

**How to apply:** Check upstream's versions of auth pages for correct import patterns:
- `@/features/auth` → `@multica/core/auth`
- `@/features/workspace` → `@multica/core/workspace`
- `@/shared/api` → `@multica/core/api`
- `@/components/ui/*` → `@multica/ui/components/ui/*`

### 3. Docker Build: ENTRYPOINT vs CMD

**Rule:** When Dockerfile has `ENTRYPOINT ["./server"]`, the migrate service's `command: ["./migrate", "up"]` results in `./server ./migrate up` which is wrong.

**Why:** Docker combines ENTRYPOINT + CMD. Use `--entrypoint ""` override when running migrations.

**How to apply:**
```bash
docker compose run --rm --entrypoint "" migrate ./migrate up
```

### 4. Password Auth on Top of Upstream

**Rule:** When adding password auth to upstream's email-verification-code flow, modify three layers: models (sqlc), handler (auth.go), and router. Don't forget to update all Scan() calls when adding a new column.

**Why:** Adding `password_hash` column to User requires updating every sqlc-generated query that SELECTs or RETURNs from `user` table. Missing one Scan call causes runtime panics.

**How to apply:** After adding column to models.go and SQL queries, update ALL generated functions to include the new field in their SELECT/RETURNING and Scan() calls.

### 5. API Client Methods Must Match Auth Store

**Rule:** When using upstream's `packages/core/auth/store.ts` with `createAuthStore()`, ensure `packages/core/api/client.ts` has all methods the store calls (sendCode, verifyCode, etc.).

**Why:** Local API client was kept during merge but only had `register`/`login`. Upstream store expected `sendCode`/`verifyCode` → TypeScript build failure.

**How to apply:** Use upstream's API client as base, then append local methods (register, login) at the end.

### 6. Don't Blindly Use Upstream Login Component After Merge

**Rule:** After merging upstream, verify that each auth page matches the local auth flow. If upstream uses email+verification-code login and local uses password login, the login page must be independently rewritten — not restored from upstream.

**Why:** After merging upstream/main, the login page at `apps/web/app/(auth)/login/page.tsx` was replaced with upstream's version, which imports `LoginPage` from `@multica/views/auth` (email + OTP flow). This broke the local password-based auth — users saw "Enter your email to get a login code" instead of email + password form.

**How to apply:**
1. After merge, immediately test ALL auth pages in browser — don't assume they survived the merge
2. The local login page should be a standalone component using `api.login()`, NOT importing `@multica/views/auth` LoginPage
3. Mark auth pages in CLAUDE.md as "本地重写，不要恢复为上游版本" to prevent future merges from overwriting them
4. E2E verification: login with `admin@local`/`admin123`, confirm redirect to `/issues`
