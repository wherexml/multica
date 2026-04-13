# Multica 架构文档

本文档是 Multica 代码库的完整架构参考。日常开发快速参考见 [CLAUDE.md](./CLAUDE.md)。

---

## 一、项目概览

**Multica** 是一个 AI-native 任务管理平台，核心理念是把 AI Agent 当作真正的团队成员来管理。

### 核心能力

- **Agent 作为成员**：可以被分配 issue、创建 issue、发表评论、修改状态
- **自主执行**：完整的任务生命周期（入队 → 认领 → 开始 → 完成/失败），通过 WebSocket 实时推送进度
- **可复用技能**：每个解决方案沉淀为团队可复用的 Skill
- **统一运行时**：本地 Daemon 和云端运行时统一管理，自动检测 CLIs
- **多工作区**：工作区级别隔离，Agent 和成员互不影响

### 技术规模

| 维度 | 数据 |
|------|------|
| Go 源文件 | 132 个 |
| TS/TSX 文件 | 247 个 |
| SQL 迁移 | 62 个（001_init → 031_...） |
| Agent 支持 | Claude Code / Codex / OpenCode |
| 数据库 | PostgreSQL 17 + pgvector |
| 部署 | Docker Compose + GoReleaser |

---

## 二、技术栈

### 后端

| 组件 | 技术选型 |
|------|----------|
| 语言 | Go 1.26 |
| HTTP 路由 | go-chi/chi/v5 |
| WebSocket | gorilla/websocket |
| DB 驱动 | jackc/pgx/v5 |
| 查询生成 | sqlc（手写 SQL → 类型安全 Go 代码） |
| 认证 | golang-jwt/jwt/v5 (HS256) |
| CLI 框架 | spf13/cobra |
| 邮件 | resend-go/v2 |
| 对象存储 | aws-sdk-go-v2 (S3) + CloudFront CDN |
| 日志 | lmittmann/tint (slog wrapper) |

### 前端

| 组件 | 技术选型 |
|------|----------|
| 框架 | Next.js 16 (App Router) |
| UI 库 | React 19 |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS 4 + class-variance-authority + tailwind-merge |
| 组件库 | shadcn/ui + @base-ui/react + radix-ui |
| 富文本编辑 | Tiptap（Markdown、代码块、@mention、表格、文件上传） |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 图表 | recharts |
| 图标 | lucide-react |
| Markdown 渲染 | react-markdown + remark-gfm + shiki |
| Toast 通知 | sonner |
| 测试 | vitest + @testing-library/react + jsdom |

### 数据库

- **引擎**：PostgreSQL 17
- **镜像**：`pgvector/pgvector:pg17`
- **ORM**：sqlc（代码生成，SQL 在 `pkg/db/queries/`，生成代码在 `pkg/db/generated/`）
- **迁移**：`migrations/` 目录下编号的 `.up.sql` / `.down.sql` 文件

### 基础设施

| 组件 | 技术选型 |
|------|----------|
| 容器化 | Docker + Docker Compose |
| 包管理 | pnpm 10.28（monorepo workspace） |
| 发布 | GoReleaser（Homebrew tap: multica-ai/tap） |
| CI/CD | GitHub Actions |
| E2E 测试 | Playwright |

---

## 三、整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Browser (Next.js)                              │
│   App Router → Pages → Zustand Stores (auth / workspace / issues)     │
│                                           ↑ WebSocket Client (reconnect) │
└──────────────────────────────────────────────┬──────────────────────────┘
                                               │ HTTP REST + WebSocket
                          ┌────────────────────┴────────────────────┐
                          │        Go Backend  (Chi Router :8080)      │
                          │                                              │
                          │  Handlers  ──▶  TaskService  ──▶  DB      │
                          │       │                                  │
                          │       │  publish                         │
                          │       ▼                                  │
                          │   EventBus  (sync pub/sub)                 │
                          │       │                                  │
                          │   ┌────┼────────────────────────────────┐ │
                          │   │    ▼                                │ │
                          │   │  ActivityListener ──▶ activity_log  │ │
                          │   │  NotificationListener ──▶ Resend     │ │
                          │   │  SubscriberListener ──▶ subscriber   │ │
                          │   │  listeners.go ──▶ WebSocket Hub      │ │
                          │   └─────────────────────────────────────┘ │
                          │                                              │
                          │  Hub (WS rooms)  ←  Daemon heartbeat/poll  │
                          │  Agent SDK (claude / codex / opencode)      │
                          └──────────────────────────────────────────────┘
                                               │ HTTP / polling
                          ┌────────────────────┴────────────────────┐
                          │    Local Daemon  (developer machine)     │
                          │   Auto-detect: claude / codex / opencode │
                          │   Poll every 3s │ heartbeat every 15s   │
                          └───────────────────────────────────────────┘
```

---

## 四、后端架构（`server/`）

### 4.1 目录结构

```
server/
├── cmd/
│   ├── server/           # HTTP API 服务入口
│   │   ├── main.go
│   │   ├── router.go
│   │   ├── listeners.go              # WS 广播
│   │   ├── activity_listeners.go    # 写 activity_log
│   │   ├── notification_listeners.go # 邮件 + inbox_item
│   │   ├── subscriber_listeners.go  # 自动订阅
│   │   └── runtime_sweeper.go       # 清理 stale runtime/task
│   ├── multica/          # CLI 入口（login / daemon / workspace / ...）
│   └── migrate/          # 数据库迁移工具
├── internal/
│   ├── handler/          # 每个域一个文件
│   ├── service/         # TaskService（核心任务编排）
│   ├── realtime/        # WebSocket Hub
│   ├── events/          # 同步内存 pub/sub
│   ├── auth/            # JWT + bcrypt
│   ├── middleware/      # Auth 中间件
│   ├── daemon/          # Local Daemon（轮询 + 执行）
│   ├── storage/         # S3 存储
│   ├── cli/             # CLI 辅助函数
│   └── logger/          # slog 封装
├── pkg/
│   ├── agent/           # Backend 接口 + 3 种实现
│   ├── protocol/        # WS 消息类型
│   ├── db/
│   │   ├── queries/    # 手写 SQL（sqlc 源）
│   │   └── generated/   # sqlc 生成的 Go 代码
│   └── redact/          # 敏感信息脱敏
└── migrations/          # 编号 SQL 迁移文件
```

### 4.2 入口层 (`cmd/server/`)

#### `main.go`

- 连接 PostgreSQL（pgxpool）
- 初始化 EventBus 和 WebSocket Hub
- 注册所有事件监听器（Activity / Notification / Subscriber / WS Broadcast）
- 启动 RuntimeSweeper 定时任务（30s 间隔）
- 启动 HTTP 服务器，支持优雅关闭

#### `router.go`

定义三类路由：

| 路由类型 | 认证方式 | 示例 |
|----------|----------|------|
| Public | 无 | `/auth/register`、`/auth/login`、`/health`、`/ws` |
| Protected | JWT Bearer | `/api/issues`、`/api/agents`、`/api/workspaces/...` |
| Daemon | Daemon Token | `/api/daemon/*` |

Middleware 栈：CORS → Auth → Workspace Membership 检查

#### `listeners.go`

WebSocket 广播层，根据事件类型路由到不同传输方式：

- `BroadcastToWorkspace(wsID, event)` — 房间内广播（issue 创建/更新等）
- `SendToUser(userID, event)` — 跨房间精确投递（inbox 通知）
- `Broadcast(event)` — 全局广播（daemon 心跳/注册）

### 4.3 处理器层 (`internal/handler/`)

每个域一个文件，持有 `Queries`、`DB Pool`、`Hub`、`TaskService` 实例：

| Handler | 文件 | 核心职责 |
|---------|------|----------|
| Auth | `auth.go` | Register（含自动建 workspace）、Login（bcrypt+JWT）、GetMe、UpdateMe |
| Workspace | `workspace.go` | Workspace CRUD、Member CRUD（含 owner 保护和最少 owner 规则） |
| Issue | `issue.go` | Issue CRUD、批量操作、Agent 触发配置（on_assign / on_comment / @mention） |
| Comment | `comment.go` | Comment CRUD、@mention 展开、线程根解析、Agent 触发调度 |
| Agent | `agent.go` | Agent CRUD + 可见性权限控制 |
| Daemon | `daemon.go` | Daemon 注册/心跳、任务认领/启动/完成/失败/进度上报、消息流 |
| Skill | `skill.go` | Skill CRUD + 文件管理 + 从 ClawHub/skills.sh 导入 |
| Inbox | `inbox.go` | 通知列表、已读/归档（支持 issue 级联归档） |
| Runtime | `runtime.go` | Runtime 列表、Usage 上报（daemon → server）和查询 |
| File | `file.go` | S3 上传（100MB 上限）+ CloudFront 签名 URL 下载 |

### 4.4 任务编排服务 (`internal/service/task.go`)

`TaskService` 管理 Agent 任务的完整生命周期：

```
EnqueueTaskForIssue   — issue 被分配给 agent 时调用
EnqueueTaskForMention — comment 中 @mention agent 时调用
ClaimTask             — daemon 认领（检查 max_concurrent_tasks）
StartTask             — daemon 开始执行
CompleteTask          — 完成：更新状态 + 向 issue 写入 agent 总结评论
FailTask              — 失败：更新状态 + reconcile agent 状态
CancelTask            — 取消：更新状态
ReportProgress        — 报告进度并 WS 广播
```

**并发控制**：`max_concurrent_tasks` per agent，ClaimTask 时检查当前 running 任务数。

**自动评论**：任务完成时，`CompleteTask` 自动向 issue 写入一条 `system` 类型评论，内容为 markdown 格式的 agent 执行总结（含耗时、输出摘要）。

**Agent 触发机制**（Issue → Agent 的"自动化规则"）：

| 触发类型 | 触发条件 | 配置字段 |
|----------|----------|----------|
| `on_assign` | Issue 被分配给此 Agent | `on_assign_trigger` |
| `on_comment` | Issue 下新增 comment | `on_comment_trigger` |
| `@mention` | comment 中 @mention 此 Agent | Agent 的 `@username` |

触发可以精确控制：只在成员对 Agent 的 thread 上触发（不在 Agent→Agent 或 Agent→成员上重复触发）。

### 4.5 事件总线 (`internal/events/`)

**同步内存 pub/sub**，支持两类订阅：

```go
Bus.Subscribe(eventType, Handler)     // 订阅特定事件类型
Bus.SubscribeAll(Handler)              // 订阅所有事件（global handler，后执行）
Bus.Publish(event)                     // 同步发布，所有 handler 在当前 goroutine 执行
```

panic 隔离：`recover()` 包装每个 handler。

### 4.6 事件监听器（`cmd/server/`）

```
ActivityListener       — 监听 issue:*/task:* → 写 activity_log
NotificationListener   — 监听 issue:*/comment:*/reaction:* → 发邮件 + 写 inbox_item
SubscriberListener     — 监听 issue:*/comment:* → 自动订阅（创建者/assignee/@mention/评论者）
```

**SubscriberListener 逻辑**：
- `issue:created`：自动订阅创建者 + 初始 assignee
- `issue:updated`：新 assignee → 自动订阅；新 @mention → 自动订阅
- `comment:created`：评论者自动订阅

**NotificationListener 逻辑**：
- `issue:created`：通知所有 subscriber
- `issue:updated`：assignee 变化 → 通知新 assignee；status/priority/due_date 变化 → 通知所有 subscriber
- `comment:created`：通知所有 subscriber + @mention 展开后的成员
- `task:failed`：通知任务发起人（issue 创建者）
- 支持 Resend 邮件发送 + inbox_item 持久化

### 4.7 WebSocket Hub (`internal/realtime/`)

房间模型：

```
Client 连接 → JWT 认证 + workspace 成员校验 → 加入 wsID 房间
BroadcastToWorkspace(wsID, event)     → 房间内所有 client
SendToUser(userID, event)            → 跨房间精确投递
Broadcast(event)                     → 全局（daemon 事件）
```

Slow client 驱逐：60s 无响应的 client 主动断开。

### 4.8 Agent SDK (`pkg/agent/`)

统一 `Backend` 接口，三种实现：

| Backend | 可执行文件 | 通信协议 | 消息类型 |
|---------|-----------|----------|----------|
| Claude Code | `claude` | `stream-json` 输出格式 | `text` / `thinking` / `tool_use` / `tool_result` |
| Codex | `codex` | JSON-RPC 2.0 over stdio（`app-server` 模式） | 同上 |
| OpenCode | `opencode` | `run --format json` 流式输出 | 同上 |

`Session` 对象管理一次任务执行的生命周期：
1. 解析/加载 agent 技能文件
2. 构造 prompt（含 system prompt、issue 描述、技能内容）
3. 启动子进程，捕获 stdout
4. 流式解析输出，通过 channel 返回 `text` / `thinking` / `tool_use` / `tool_result`
5. 任务结束时写入 `Session.Result` channel

**任务消息持久化**：每条消息（带 `seq` 序列号）存入 `task_message` 表，daemon 通过 `ReportTaskMessages` 批量上报。

### 4.9 Local Daemon (`internal/daemon/`)

运行在开发者机器上的本地 Agent 运行时：

```
daemon.go     — 主循环：注册 runtime → 循环（轮询 + 心跳）
poller.go     — 每 3s GET /pending → POST /claim → 启动 executor
executor.go   — 启动 agent CLI、写入工作目录、流式处理输出、上报完成
config.go     — server_url、daemon_id、heartbeat_interval(15s)、agent_timeout(2h)
```

健康检查端口：19514（`GET /health`）

---

## 五、前端架构（`apps/web/`）

### 5.1 目录结构

```
apps/web/
├── app/                           # App Router：薄路由层
│   ├── (auth)/                    # 登录 / 注册
│   ├── (dashboard)/               # 工作台：board / issues / agents / inbox / settings
│   │   ├── _components/          # dashboard 共享组件（如 AppSidebar）
│   │   ├── board/page.tsx        # Kanban board（coming soon）
│   │   ├── issues/page.tsx       # issues 列表
│   │   ├── issues/[id]/page.tsx  # issue 详情
│   │   ├── agents/page.tsx        # agents 管理（CRUD + 面板）
│   │   ├── inbox/page.tsx         # 通知收件箱
│   │   └── settings/page.tsx      # 设置页（账户 + workspace）
│   └── (landing)/                 # 营销页：homepage / about / changelog
├── features/                      # 业务域模块（feature-based）
│   ├── auth/                     # useAuthStore + AuthInitializer
│   ├── workspace/                # useWorkspaceStore（核心协调器）
│   ├── issues/                   # useIssueStore + 组件
│   ├── inbox/                    # useInboxStore
│   ├── realtime/                 # WSProvider + useRealtimeSync
│   ├── runtimes/                 # useRuntimeStore
│   ├── navigation/                # useNavigationStore
│   ├── modals/                    # ModalRegistry
│   └── skills/                   # Skill 浏览器
├── shared/                        # 跨域公共代码
│   ├── api/                      # ApiClient + WSClient + api 单例
│   ├── types/                    # TypeScript 类型（镜像后端域模型）
│   └── hooks/                    # useFileUpload 等
└── components/                    # 少量共享组件（theme、icon、common）
```

### 5.2 状态管理

**Zustand**（唯一全局状态方案，React Context 仅用于 WS 连接生命周期）：

```typescript
useAuthStore
  ├── state: user, isLoading
  └── actions: initialize(), register(), login(), logout(), setUser()

useWorkspaceStore
  ├── state: workspace, workspaces, members, agents, skills
  └── actions:
        hydrateWorkspace()    ← 启动入口，并行加载所有数据
        switchWorkspace()     ← 切换时先清空所有 store，再加载
        refreshMembers()
        refreshAgents()
        updateAgent()
        refreshSkills()
        upsertSkill()
        createWorkspace() / updateWorkspace() / leaveWorkspace()

useIssueStore
  ├── state: issues, loading, activeIssueId
  └── actions: fetch(), setIssues(), addIssue(), updateIssue(), removeIssue()

useInboxStore
  └── state: inboxItems, unreadCount

useRuntimeStore
  └── state: runtimes, selectedRuntimeId
```

**跨 Store 协调**：`useWorkspaceStore` 内部在 action 中直接调用 `useIssueStore.getState()`、`useInboxStore.getState()` 触发加载/清空，**不在组件层用 hooks 跨 store 读取**。

**依赖方向**（禁止反向）：
```
workspace → auth
realtime  → auth
issues    → workspace
inbox     → workspace
```

### 5.3 API 层（`shared/api/`）

#### ApiClient

单例 HTTP 客户端，Bearer token + `X-Workspace-ID` 请求头：

```typescript
api.register(email, name, password) → POST /auth/register
api.login(email, password)          → POST /auth/login
api.getMe()                         → GET /auth/me
// ... 所有 REST 端点的类型安全封装
```

#### WSClient

WebSocket 客户端，自动重连（3s 延迟）：

```typescript
ws.connect()                          // 连接 ws://host/ws?token=&workspace_id=
ws.on('issue:created', handler)       // 订阅特定事件
ws.onReconnect(() => { /* 重新初始化 */ })  // 重连回调
```

### 5.4 WebSocket 实时同步（`use-realtime-sync.ts`）

WS 事件 → Zustand Store 变更的中央映射层：

```typescript
issue:created   → useIssueStore.addIssue()
issue:updated   → useIssueStore.updateIssue()  // 精确合并，不全量刷新
issue:deleted   → useIssueStore.removeIssue()
inbox:new       → useInboxStore.addItem()
inbox:read      → useInboxStore.markRead()
inbox:archived  → useInboxStore.archive()
member:added / member:removed / workspace:deleted
              → toast 提示 + refreshWorkspaces()
* (其他事件)   → 100ms debounce 后批量 refresh()
reconnect       → 全量重新初始化所有 store
```

### 5.5 认证流程

```
RootLayout (app/layout.tsx)
  └── AuthInitializer (挂载时执行一次)
        ├── token 存在？
        │     ├── 是 → api.getMe() + api.listWorkspaces() 并行
        │     │         成功 → setAuth() + hydrateWorkspace()
        │     │             hydrateWorkspace:
        │     │               并行加载 members + agents + skills + issues + inbox
        │     └── 否 → 清除 localStorage，等待用户操作
        └── 失败 → 清除 token，重定向 /
```

Login/Register 页面：调用 store action → 成功后 `hydrateWorkspace()`。

---

## 六、数据库架构

### 6.1 ER 关系

```
User
  └──< Member >──────────────────── Workspace
           │                              │
           │                              ├──< Issue
           │                              │       ├──< Comment ────< Reaction
           │                              │       ├──< Subscriber
           │                              │       ├──< ActivityLog
           │                              │       ├──< Attachment
           │                              │       └──< AgentTaskQueue ────< TaskMessage
           │                              │
           │                              ├──< Agent
           │                              │       └──< Runtime ────< RuntimeUsage
           │                              │       └──< AgentSkill (junction)
           │                              │
           │                              ├──< Skill ────< SkillFile
           │                              │
           │                              └──< InboxItem
           │
           └──< PersonalAccessToken
                    DaemonToken
```

### 6.2 核心表设计

#### issue 表
- 多态 Assignee：`assignee_type`（member/agent）+ `assignee_id`
- 多态 Creator：`creator_type` + `creator_id`
- Issue 编号：`workspace_id` 内自增 `number`，不重复
- 状态：7 种（`backlog` / `todo` / `in_progress` / `in_review` / `done` / `canceled` / `duplicate`）
- 优先级：5 级（`urgent` / `high` / `medium` / `low` / `no_priority`）
- 支持父子关系：`parent_issue_id`
- 位置排序：`position`（浮点数，支持拖拽重排）

#### agent_task_queue 表
- 状态：`queued` → `dispatched` → `running` → `completed` / `failed` / `cancelled`
- 关键时间戳：`dispatched_at` / `started_at` / `completed_at`
- 结果追踪：`result`（完成摘要）+ `error`（失败原因）

#### task_message 表
- 序列号：`seq`（递增，保证顺序）
- 消息类型：`text` / `thinking` / `tool_use` / `tool_result` / `error`
- 工具调用追踪：`tool` + `input` + `output`

#### workspace 表
- `settings`：JSONB，支持灵活配置
- `issue_prefix`：Issue 编号前缀（如 `PROJ-`）

#### agent 表
- `instructions`：Agent system prompt
- `runtime_mode`：`local` / `cloud`
- `visibility`：`private` / `workspace`
- `max_concurrent_tasks`：并发任务上限
- Agent 触发配置：`on_assign_trigger` / `on_comment_trigger`

### 6.3 多租户

所有查询按 `workspace_id` 过滤。成员资格（`member` 表）控制访问权限。`X-Workspace-ID` 请求头指定当前工作区。

---

## 七、事件系统全貌

```
HTTP Request
    │
    ▼
Handler（写 DB）
    │
    ▼ publish
EventBus
    │
    ├── ActivityListener     ──▶ 写 activity_log（变更字段级追踪）
    ├── NotificationListener ──▶ 发邮件（Resend）+ 写 inbox_item
    ├── SubscriberListener  ──▶ 自动订阅（创建者/assignee/@mention/评论者）
    │
    ▼
listeners.go
    │
    ├── BroadcastToWorkspace(wsID, event)   ──▶ WS 房间内所有 client
    ├── SendToUser(userID, event)            ──▶ 跨房间精确投递（inbox）
    └── Broadcast(event)                     ──▶ 全局（daemon 事件）
```

**WebSocket 事件类型**：

| 事件 | 触发时机 |
|------|----------|
| `issue:created/updated/deleted` | Issue CRUD |
| `comment:created/updated/deleted` | Comment CRUD |
| `agent:status/created/archived/restored` | Agent 状态变化 |
| `task:dispatch/progress/completed/failed/cancelled` | 任务生命周期 |
| `task:message` | Agent 输出流 |
| `inbox:new/read/archived/batch-read/batch-archived` | 通知管理 |
| `workspace:updated/deleted` | Workspace 管理 |
| `member:added/updated/removed` | 成员管理 |
| `skill:created/updated/deleted` | Skill 管理 |
| `subscriber:added/removed` | 自动订阅 |
| `reaction:added/removed` | 反应 |

---

## 八、部署架构

### 8.1 容器化（Docker Compose）

```yaml
services:
  postgres:   image: pgvector/pgvector:pg17  → 暴露 :5432
  backend:   Go server                        → 暴露 :8080
  frontend:  Next.js standalone                → 暴露 :3000
  migrate:   one-shot migration job (profile)  → 退出后自动销毁
```

端口映射（`.env.container`）：PostgreSQL `:22000`、Backend `:22001`、Frontend `:22002`

### 8.2 API Rewrite 架构（关键）

Next.js rewrite 在容器内**服务端**执行，浏览器永远不会看到 Docker 内部主机名：

```
浏览器  →  /api/issues  (相对 URL)
Next.js 服务端  →  rewrite  →  http://backend:8080/api/issues
```

**环境变量规则**：
- `NEXT_PUBLIC_API_URL` — **必须为空**，让浏览器走相对路径
- `BACKEND_REWRITE_URL` — Next.js 服务端 rewrite 目标（`http://backend:8080`）

> 常见错误：设置 `NEXT_PUBLIC_API_URL=http://backend:8080` → Docker 内部主机名被打包进客户端 JS，浏览器 `ERR_NAME_NOT_RESOLVED`。

### 8.3 CLI 发布

```
git tag v0.x.x  →  git push origin v0.x.x  →  GitHub Actions  →
  GoReleaser  →  GitHub Releases + Homebrew tap multica-ai/tap
```

### 8.4 本地 Daemon 配置

```bash
# 配置后端地址
multica config set server_url http://localhost:22001

# 认证（打开浏览器 OAuth）
multica auth login

# 监听 workspace
multica workspace watch <workspace-id>

# 启动 daemon
multica daemon start

# 查看状态
multica daemon status
```

配置文件位置：`~/.multica/config.json`

---

## 九、关键设计决策

| 维度 | 决策 | 理由 |
|------|------|------|
| **前后端分离** | Go 后端完全独立，前端 Next.js 纯 SPA，API rewrite 解决跨域 | 解耦部署、独立迭代 |
| **DB 查询** | sqlc 手写 SQL 生成类型安全代码，不用 ORM | SQL 精确可控，类型安全有保障 |
| **实时通信** | 服务端 WebSocket Hub + 房间模型 + 客户端 WSClient 自动重连 | 低延迟、支持多 workspace 并发 |
| **Agent 协议** | 统一 Backend 接口，支持 Claude/Codex/OpenCode 三种 CLI | 用户可选，不绑定供应商 |
| **事件处理** | 同步内存 pub/sub（EventBus），监听器在主流程中执行 | 简单可靠，无额外基础设施依赖 |
| **状态同步** | WS 事件驱动精确更新（add/update/remove），非全量拉取 | 性能最优，用户体验好 |
| **多态模型** | `type + id` 模式支持 Agent/Member 角色互换 | 灵活扩展，不改 schema |
| **存储分离** | 文件走 S3 + CloudFront，DB 只存 URL | 减轻 DB 负担，CDN 加速全球访问 |
| **Agent 触发** | `on_assign` / `on_comment` / `@mention` 三种触发器 | 灵活自动化规则，支持精确控制 |
| **Task 持久化** | 每条 agent 输出消息存 `task_message` 表 | 支持事后回放、重试、调试 |

---

## 十、常见开发任务参考

### 修改 API 端点

1. 后端：`server/internal/handler/<domain>.go` 添加/修改方法
2. 数据库查询：`server/pkg/db/queries/<domain>.sql` 写 SQL
3. 运行 `make sqlc` 重新生成 Go 代码
4. 前端：`apps/web/shared/api/client.ts` 添加 ApiClient 方法
5. 前端类型：`apps/web/shared/types/index.ts` 导出类型
6. 前端 store：`apps/web/features/<feature>/store.ts` 添加 action

### 添加新 Agent Backend

1. `server/pkg/agent/<name>.go` 实现 `Backend` 接口
2. `server/internal/daemon/executor.go` 添加 provider 分支
3. `server/internal/daemon/config.go` 添加 CLI 检测逻辑

### 理解 WebSocket 事件流

```
Handler 写 DB
  → Publish(EventBus)
    → NotificationListener（可能发邮件 + 写 inbox）
    → ActivityListener（写日志）
    → SubscriberListener（更新订阅）
    → listeners.go
      → Hub.BroadcastToWorkspace(wsID, event)
        → 所有 WS 房间内的浏览器 client 收到事件
          → WSClient.on(event, handler)
            → useRealtimeSync
              → Zustand Store 精确更新
                → React 组件 re-render
```

### 数据库迁移

```bash
# 创建迁移文件
cat > migrations/<next>_add_foo.up.sql << 'EOF'
CREATE TABLE foo (...);
EOF
cat > migrations/<next>_add_foo.down.sql << 'EOF'
DROP TABLE foo;
EOF

# 应用迁移
make migrate-up

# 回滚
make migrate-down
```

---

*本文档由代码库分析自动生成，最后更新跟随 `ARCHITECTURE.md` 的 git commit。*
