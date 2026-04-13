# Smoke Test Checklist

Use this checklist before merging changes that may affect the authenticated product experience.

## Preconditions

- Start the full stack locally with a working frontend and backend.
- Use a real test account that can sign in with email and password.
- Use a test user that belongs to at least two workspaces for workspace switching coverage.
- Ensure the selected workspace has at least:
  - one issue
  - one project
  - one agent
  - one runtime, or a workspace where the empty state is the expected result
  - one skill, or a workspace where the empty state is the expected result

## Verification Order

Run verification in this order:

1. `pnpm lint`
2. `pnpm test`
3. `pnpm typecheck`
4. `pnpm --filter @multica/web build`
5. `cd server && go test ./...`

## Smoke Flow

Follow the product checks in this order so auth, workspace state, navigation, and detail views are validated together.

### 1. Login

- [ ] Open the login page.
- [ ] Sign in with a valid email and password.
- [ ] Confirm the app redirects to `/issues` after a successful login.
- [ ] Confirm the signed-in session persists after a refresh.
- [ ] Sign out from the workspace switcher menu.
- [ ] Confirm the app returns to an unauthenticated state.
- [ ] Sign in again with the same email and password.
- [ ] Confirm the app still loads the dashboard without auth errors.

### 2. Workspace Switching

- [ ] Open the workspace switcher in the sidebar header.
- [ ] Confirm the current workspace name is shown in the trigger.
- [ ] Switch to a different workspace.
- [ ] Confirm navigation lands on `/issues`.
- [ ] Confirm the issues list refreshes for the newly selected workspace.
- [ ] Confirm the browser refresh keeps the selected workspace.
- [ ] Switch back to the original workspace.
- [ ] Confirm data updates again and no stale content remains visible.

### 3. Issues List and Detail

- [ ] Visit `/issues`.
- [ ] Confirm the page renders without crashes or blank states caused by errors.
- [ ] Confirm the workspace breadcrumb and issue list are visible.
- [ ] Open an issue from the list or board.
- [ ] Confirm the detail page loads at `/issues/:id`.
- [ ] Confirm the issue identifier and title are visible.
- [ ] Confirm returning to the issues list works.
- [ ] Refresh the issue detail page and confirm it still loads correctly.

### 4. Projects List and Detail

- [ ] Visit `/projects`.
- [ ] Confirm the projects page renders without crashes or blank states caused by errors.
- [ ] Confirm project data loads successfully from the projects backend routes.
- [ ] Confirm the backend routes used by this flow are available under `/api/projects`.
- [ ] Open a project from the list.
- [ ] Confirm the detail page loads at `/projects/:id`.
- [ ] Confirm the project title is visible.
- [ ] Confirm project issues or the expected empty state are visible.
- [ ] Refresh the project detail page and confirm it still loads correctly.

### 5. Agents

- [ ] Visit `/agents`.
- [ ] Confirm the agents page renders without crashes.
- [ ] Confirm the list panel loads agents or shows the expected empty state.
- [ ] Select an agent when one exists.
- [ ] Confirm the detail panel loads.

### 6. Runtimes

- [ ] Visit `/runtimes`.
- [ ] Confirm the runtimes page renders without crashes.
- [ ] Confirm the list panel loads runtimes or shows the expected empty state.
- [ ] Select a runtime when one exists.
- [ ] Confirm the detail panel loads.

### 7. Skills

- [ ] Visit `/skills`.
- [ ] Confirm the skills page renders without crashes.
- [ ] Confirm the list panel loads skills or shows the expected empty state.
- [ ] Select a skill when one exists.
- [ ] Confirm the detail panel loads.

### 8. Settings

- [ ] Visit `/settings`.
- [ ] Confirm the settings page renders without crashes.
- [ ] Confirm account tabs are visible.
- [ ] Confirm workspace tabs are visible.
- [ ] Open at least one account tab and one workspace tab.
- [ ] Confirm both tabs render usable content without errors.

### 9. Inbox

- [ ] Visit `/inbox`.
- [ ] Confirm the inbox page renders without crashes.
- [ ] Confirm the list panel loads inbox items or shows the expected empty state.
- [ ] Confirm unread count is visible in the sidebar badge (when items exist).
- [ ] Mark an item as read and confirm it updates.
- [ ] Archive an item and confirm it is removed from the active list.

### 10. Registration (Optional)

- [ ] Visit `/register`.
- [ ] Confirm the registration form renders with email and password fields.
- [ ] Submit a new registration and confirm it succeeds or shows a validation error.
- [ ] Confirm the new account can sign in via `/login`.

## Sign-off

- [ ] All verification commands completed in the required order.
- [ ] All smoke checks above passed.
- [ ] Any failures were fixed or documented before merge.
