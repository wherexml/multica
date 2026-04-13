# Step 1: Coding Process (CodeAgent/codex)

## BASE-P0-001: 修复 Projects API 路由缺失
- **Status**: ALREADY DONE (验证通过)
- **发现**: `/api/projects` 路由已在 `router.go:200-209` 注册，包含 GET/POST/PUT/DELETE/Search
- **handler**: `project.go` 已有完整的 CRUD 实现
- **验证**: `go build ./cmd/server` 通过

---

## BASE-P0-002: 建立基线冒烟清单与改造分支保护
- **Status**: COMPLETED
- **Backend**: codex
- **Duration**: ~8 min (493s)
- **Files Created/Modified**:
  - `docs/internal/smoke-checklist.md` (NEW) — 114 lines, comprehensive smoke checklist
  - `.github/PULL_REQUEST_TEMPLATE.md` (MODIFIED) — added Impact Review section with 4 checkboxes
- **CodeAgent Notes**:
  - 产出质量良好，英文注释
  - 覆盖了登录、工作区切换、Issues、Projects、Agents、Runtimes、Skills、Settings
  - 验证顺序正确：lint → test → typecheck → build → go test
  - PR 模板新增了 API/Migration/i18n/Routing 影响评估复选框
- **Known Issues** (非本次改动导致):
  - `pnpm lint` 当前在 web 包失败
  - `pnpm typecheck` 卡在 `.next/dev/types` 旧引用
  - `pnpm build` 因 Google Fonts 不可用失败

---

## BASE-P0-003: 冻结语义映射与命名词典
- **Status**: COMPLETED
- **Backend**: codex
- **Duration**: ~4 min (252s)
- **Files Created/Modified**:
  - `packages/core/platform/lexicon.ts` (NEW) — 89 lines, typed lexicon with 25 terms
  - `packages/core/platform/index.ts` (MODIFIED) — added lexicon exports
- **Key Features**:
  - 25 business terms mapped (zh-CN + en-US)
  - Type-safe `LexiconKey` union type
  - `t(key, locale?)` helper with default zh-CN
  - `normalizeLocale()` handles zh→zh-CN, en→en-US
  - `getDefaultLocale()` returns zh-CN
  - Zero external dependencies
- **Note**: design.md Section 4.1 already contains navigation mapping, no changes needed

---

## I18N-P0-004: 引入 zh-CN 默认的 i18n 骨架
- **Status**: COMPLETED
- **Backend**: codex
- **Duration**: ~9.5 min (573s)
- **Architecture Decision**: Did NOT install next-intl. Built lightweight custom i18n using existing Lexicon + JSON messages + React Context.
- **Files Created**:
  - `apps/web/messages/loader.ts` — Message loader with en-US fallback
  - `apps/web/messages/loader.test.ts` — Loader tests
  - `apps/web/messages/zh-CN/common.json` — 12 common UI labels
  - `apps/web/messages/zh-CN/navigation.json` — 8 navigation labels
  - `apps/web/messages/zh-CN/settings.json` — 8 settings labels
  - `apps/web/messages/en-US/common.json` — English equivalents
  - `apps/web/messages/en-US/navigation.json` — English equivalents
  - `apps/web/messages/en-US/settings.json` — English equivalents
  - `apps/web/components/i18n-provider.tsx` — React Context + useI18n() hook
- **Files Modified**:
  - `apps/web/components/locale-sync.tsx` — Uses normalizeAppLocale
  - `apps/web/app/layout.tsx` — lang="en" → lang="zh-CN"
- **Key Design**:
  - `I18nProvider` wraps app, provides `t(key)`, `setLocale()`, `locale`
  - `t()` lookup order: JSON messages → Lexicon → key-as-is
  - Cookie persistence with BCP 47 values (zh-CN, en-US)
  - Normalization: zh→zh-CN, en→en-US
  - Default: zh-CN
- **Verification**: `pnpm --filter @multica/core typecheck` PASS

---

## I18N-P0-005: 侧边导航改为 labelKey 驱动
- **Status**: COMPLETED
- **Backend**: codex
- **Duration**: ~7.5 min (457s)
- **Files Modified**:
  - `packages/views/layout/app-sidebar.tsx` (+53/-16 lines)
- **Key Changes**:
  - Static `label` → `labelKey` with typed `SidebarNavKey` union
  - Added `getSidebarLocale()` helper for cookie-based locale detection
  - Added `getSidebarLabel(key, locale)` using `lexiconT()` from `@multica/core/platform`
  - Preserved unread count logic (`item.labelKey === "inbox"`)
  - Preserved runtime update badge (`item.labelKey === "runtime"`)
  - Non-lexicon labels (Pinned, Configure, etc.) kept as-is for now
- **Verification**: `pnpm --filter @multica/core typecheck` PASS, `pnpm --filter @multica/views typecheck` PASS

---

## I18N-P0-006: 设置页全面中文化
- **Status**: COMPLETED
- **Backend**: codex
- **Duration**: ~18 min (1071s) — largest task in batch
- **Files Created**:
  - `packages/core/platform/settings-messages.ts` (NEW, 287 lines) — ~111 settings strings in zh-CN + en-US with interpolation
  - `packages/core/platform/settings-messages.test.ts` (NEW) — Tests
  - `packages/views/settings/components/settings-page.test.tsx` (NEW) — Component test
- **Files Modified**:
  - `packages/core/platform/index.ts` — Added settings exports
  - `packages/views/settings/components/settings-page.tsx` — All labels i18n'd
  - `packages/views/settings/components/account-tab.tsx` — All labels i18n'd
  - `packages/views/settings/components/appearance-tab.tsx` — Theme labels
  - `packages/views/settings/components/tokens-tab.tsx` — Token management
  - `packages/views/settings/components/workspace-tab.tsx` — Workspace settings
  - `packages/views/settings/components/members-tab.tsx` — Member management
  - `packages/views/settings/components/repositories-tab.tsx` — Repository management
- **Architecture**: New `settingsT(key, locale, params?)` function in `@multica/core/platform`
- **Key Design**:
  - Parametrized interpolation: `{name}` → actual value
  - Falls back to Lexicon for core terms (workspace → 业务空间)
  - Cookie-based locale via `getSettingsLocale()`
- **Verification**: `pnpm --filter @multica/core typecheck` PASS, `pnpm --filter @multica/views typecheck` PASS

---

(后续任务记录将在此追加)
