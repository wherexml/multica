# Step 2: Review (Haiku subagent)

## BASE-P0-001
- **Status**: N/A (任务已在仓库中完成，无需 review)

---

## BASE-P0-002: 建立基线冒烟清单与改造分支保护
- **Reviewer**: Haiku subagent
- **Overall Quality**: Good
- **Verdict**: NEEDS CHANGES (minor)

### Issues Found
1. **Missing `/inbox` section** (Major) — Inbox is a valid dashboard route with backend API support (`/api/inbox`), page exists at `apps/web/app/(dashboard)/inbox/page.tsx`. Must add smoke section.
2. **Missing register flow** (Minor) — The codebase has local password auth with `/auth/register`, unique vs upstream. Should add optional registration smoke items.
3. **Line 69: API-path mention** (Minor) — `/api/projects` mention is implementation-centric; other sections don't mention API paths. Inconsistent but not blocking.
4. **Line 38: Sign-out location** (Minor) — Assumes sign-out is in workspace switcher. Should verify actual UI placement.

### Positive Findings
- Verification order is correct and matches existing scripts
- Agents/Runtimes/Skills correctly use "detail panel" (not page) — matches codebase panel pattern
- PR template Impact Review section is well-structured
- English quality is good throughout
- Preconditions are practical (two workspaces, sample data requirements)

### Fix Required
- Add Inbox smoke section (Section 9)
- Optionally add Registration smoke section

---

## BASE-P0-003: 冻结语义映射与命名词典
- **Reviewer**: Haiku subagent
- **Overall Quality**: Good
- **Verdict**: PASS

### Checklist
- ✅ All 25 required mappings present in both zh-CN and en-US
- ✅ Type safety: `LexiconKey` derived via `keyof typeof` with `as const`
- ✅ `t()` API is ergonomic, default locale works correctly
- ✅ `normalizeLocale()` correctly maps zh→zh-CN, en→en-US
- ✅ Zero external dependencies
- ✅ No non-English comments
- ✅ All public APIs exported from index.ts
- ✅ design.md Section 4.1 already has navigation mapping

### Minor Notes (non-blocking)
- Type strictness asymmetry: zhCnLexicon uses `as const`, enUsLexicon uses `Record<>` — not a functional issue
- DEFAULT_LOCALE is zh-CN by design (correct for the project's Chinese-first audience)

---

## I18N-P0-004: 引入 zh-CN 默认的 i18n 骨架
- **Reviewer**: Haiku subagent
- **Overall Quality**: Good
- **Verdict**: PASS (15/15 criteria pass)

### Checklist Results
- ✅ Lexicon integration correct
- ✅ t() lookup order: JSON → Lexicon → key-as-is
- ✅ Root layout remains Server Component (no cookies())
- ✅ LocaleSync avoids making layout dynamic
- ✅ normalizeAppLocale handles zh→zh-CN, en→en-US
- ✅ Cookie uses BCP 47 values
- ✅ Default locale is zh-CN
- ✅ getMessages() merges with en-US fallback
- ✅ Message files have same keys in both locales
- ✅ Navigation.json matches Lexicon values
- ✅ useI18n() properly typed
- ✅ Throws outside context
- ✅ No race conditions
- ✅ I18nProvider mounted in dashboard layout
- ✅ Landing page i18n untouched

### Minor Observations (non-blocking)
- LocaleSync and I18nProvider both set html lang — harmless redundancy by design
- t() accepts string, not typed keys — intentional for flexibility
- Test coverage exists for loader, provider, and locale-sync

---

## I18N-P0-005: 侧边导航改为 labelKey 驱动
- **Reviewer**: Sonnet subagent (combined review + test)
- **Overall Quality**: Good
- **Verdict**: PASS (8/8 review + 24/24 mapping + 8/8 edge cases)

### Review Checklist
- ✅ All nav items use labelKey instead of hardcoded label
- ✅ SidebarNavKey type covers all 8 navigation items
- ✅ Cookie-based locale detection with zh-CN default
- ✅ lexiconT() correctly called for label resolution
- ✅ Inbox unread badge preserved (labelKey === "inbox")
- ✅ Runtime update badge preserved (labelKey === "runtime")
- ✅ No hardcoded business labels in nav arrays
- ✅ Non-lexicon UI chrome (Pinned, Configure, etc.) acceptable as-is

### Test Results
- TypeScript compilation: PASS
- 24/24 mapping verification (8 keys × 2 locales + 8 edge cases): PASS
- Unit tests (4 files, 13 tests): ALL PASS

### Step 4 (Fix): SKIPPED
No fixes needed.

---

## I18N-P0-006: 设置页全面中文化
- **Reviewer**: Haiku subagent
- **Overall Quality**: Good
- **Verdict**: PASS (100% Chinese coverage)
- **Coverage**: 111/111 strings translated

### Review Checklist
- ✅ All hardcoded English replaced with settingsT()
- ✅ Chinese coverage 100% (124 keys in both locales)
- ✅ zh-CN and en-US keys match exactly
- ✅ Workspace → 业务空间 everywhere
- ✅ Tab labels correct: 个人资料, 外观, API令牌, 通用设置, 代码仓库, 成员管理
- ✅ Member roles: 所有者, 管理员, 成员
- ✅ Parametrized interpolation works ({name}, {count}, {date})
- ✅ settingsT() falls back to Lexicon for core terms
- ✅ Cookie-based locale via getSettingsLocale()
- ✅ All components "use client" compatible
- ✅ Toast messages (sonner) translated
- ✅ Dialog titles/descriptions translated
- ✅ No remaining hardcoded English UI strings

### Minor Observations (non-blocking)
- getSettingsLocale() re-reads cookie on every render (lightweight sync call, acceptable)
- No reactive language switching (requires navigation to see changes)

### Step 4 (Fix): SKIPPED
No fixes needed.

---

(后续任务记录将在此追加)
