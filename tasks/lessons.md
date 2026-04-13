# Lessons

- No session-specific lessons recorded yet.
- Docker redeploys must use `.env.container`; the default `.env` is for local dev and can silently put the container stack on the wrong ports and auth origins.
- If the runtime image keeps `ENTRYPOINT ["./server"]`, the compose `migrate` service must override entrypoint to `./migrate`; otherwise `docker compose run migrate` starts the server and hangs instead of applying migrations.
- The active deployment port range for this workspace must match the current task target exactly; `2200X` and `2220X` both exist in repo history, so always verify the requested frontend URL before rebuilding containers or repointing the daemon.
- **Sidebar invisible fix**: If the left sidebar is completely missing (even in incognito), check `apps/web/app/(dashboard)/layout.tsx`. It must include `AppSidebar` inside `SidebarProvider`. The upstream or some local edits may have removed it, leaving only `SidebarInset` (main content). Always ensure `AppSidebar` is rendered alongside `SidebarInset` in the dashboard root layout.
