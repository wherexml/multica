# CLAUDE.md — Claude Code 项目指南

本文件为 Claude Code (claude.ai/code) 提供代码库工作指导。

## 项目背景

**Multica** 是一个 AI 原生的任务管理平台 —— 类似 Linear，但 AI Agent 是第一等公民。

- **Agent 可以**：被分配 issue、创建 issue、评论、修改状态
- **运行时支持**：本地（daemon）和云端两种模式
- **目标用户**：2-10 人的 AI 原生团队

## 技术架构

**Go 后端 + 独立部署的 Next.js 前端。**

| 目录 | 技术栈 | 作用 |
|------|--------|------|
| `server/` | Go (Chi 路由 + sqlc + gorilla/websocket) | 后端 API 服务 |
| `apps/web/` | Next.js 16 (App Router) | 前端 Web 应用，完全自包含，无共享包依赖 |

### 前端目录结构 (`apps/web/`)

前端采用**特性优先架构**，分为三层：

```
apps/web/
├── app/          # 路由层（薄壳，引用 features/ 中的内容）
├── features/     # 业务逻辑，按领域组织
└── shared/       # 跨特性工具（api 客户端、类型定义、logger）
```

### `app/` — 路由层

Next.js App Router 页面文件。**路由文件应该尽量薄**：只做 import 和 re-export，不写业务逻辑。

- 布局组件和路由级粘合逻辑（重定向、权限守卫）放这里
- 共享布局组件（如 `app-sidebar`）放在 `app/(dashboard)/_components/` 中

### `features/` — 业务特性模块

按领域拆分的模块，每个模块包含自己的 components、hooks、stores 和 config：

| 特性模块 | 职责 | 导出内容 |
|----------|------|----------|
| `features/auth/` | 认证状态管理 | `useAuthStore`、`AuthInitializer` |
| `features/workspace/` | 工作区、成员、AI Agent | `useWorkspaceStore`、`useActorName` |
| `features/issues/` | Issue 状态、组件、配置 | `useIssueStore`、图标、选择器、状态/优先级配置 |
| `features/inbox/` | 收件箱通知状态 | `useInboxStore` |
| `features/realtime/` | WebSocket 连接与同步 | `WSProvider`、`useWSEvent`、`useRealtimeSync` |
| `features/modals/` | 弹窗注册与状态 | Modal store 及相关组件 |
| `features/skills/` | AI Skill 管理 | Skill 相关组件 |

### `shared/` — 跨模块公共代码

多个特性模块共用的代码：

| 子目录/文件 | 作用 |
|-------------|------|
| `shared/api/` | `ApiClient`（REST）和 `WSClient`（WebSocket）客户端，以及 `api` 单例 |
| `shared/types/` | 领域类型定义（Issue、Agent、Workspace 等）及 WebSocket 事件类型 |
| `shared/logger.ts` | 日志工具 |

## 状态管理

| 方案 | 适用场景 |
|------|----------|
| **Zustand** | 全局客户端状态，每领域一个 store |
| **React Context** | 仅用于连接生命周期（`WSProvider`） |
| **useState** | 组件本地的 UI 状态（表单、弹窗、筛选器） |

> **注意**：不要用 React Context 替代 Zustand store 能管理的共享数据。

### Store 规范

- 每个领域一个 store，通过 selector 调用：`useAuthStore(selector)`
- Store **禁止调用** `useRouter` 或其他 React hooks，导航逻辑放在组件层
- 跨 store 读取：在 action 内使用 `useOtherStore.getState()`（不用 hooks）
- 依赖方向：`workspace` → `auth`、`realtime` → `auth`、`issues` → `workspace`，**禁止反向**

## 导入别名

使用 `@/` 别名（映射到 `apps/web/` 根目录）：

```typescript
import { api } from "@/shared/api";
import type { Issue } from "@/shared/types";
import { useAuthStore } from "@/features/auth";
import { useWorkspaceStore } from "@/features/workspace";
import { useIssueStore } from "@/features/issues";
import { useInboxStore } from "@/features/inbox";
import { useWSEvent } from "@/features/realtime";
import { StatusIcon } from "@/features/issues/components";
```

- 在同一特性模块内：使用相对导入
- 跨特性或导入 shared：使用 `@/` 别名

## 数据流

```
浏览器 → ApiClient (shared/api) → REST API (Chi handlers) → sqlc 查询 → PostgreSQL
浏览器 ← WSClient (shared/api)  ← WebSocket    ← Hub.Broadcast() ← Handlers/TaskService
```

## 后端结构 (`server/`)

### 程序入口 (`cmd/`)

| 文件/目录 | 作用 |
|-----------|------|
| `cmd/server/` | HTTP API 服务主入口 |
| `cmd/multica/` | CLI 工具（daemon 管理、Agent 管理、配置命令） |
| `cmd/migrate/` | 数据库迁移工具 |

### 处理器层 (`internal/handler/`)

每个领域一个文件（issue、comment、agent、auth、daemon 等），每个 handler 持有 `Queries`、`DB`、`Hub` 和 `TaskService` 实例。

### 实时通信 (`internal/realtime/`)

Hub 负责管理 WebSocket 客户端。服务端通过 `Hub.Broadcast()` 广播事件；入站 WS 消息路由功能仍在 TODO 中。

### 认证 (`internal/auth/` + `internal/middleware/`)

- 使用 JWT (HS256) 认证
- Middleware 设置 `X-User-ID` 和 `X-User-Email` 请求头
- 登录时如果用户不存在会自动创建

### 任务生命周期 (`internal/service/task.go`)

编排 Agent 工作流程：入队 → 认领 → 开始 → 完成/失败。自动同步 Issue 状态，并在每个状态转换时通过 WebSocket 广播事件。

### Agent SDK (`pkg/agent/`)

统一的 `Backend` 接口，通过 Claude Code 或 Codex 执行 prompt。每个 backend 启动对应的 CLI，通过 `Session.Messages` 和 `Session.Result` channel 流式返回结果。

### 本地 Daemon (`internal/daemon/`)

本地 Agent 运行时：
- 自动检测可用的 CLI（claude、codex）
- 注册运行时
- 轮询任务队列
- 按 provider 路由任务

### CLI 工具 (`internal/cli/`)

`multica` CLI 的共享辅助函数：API 客户端封装、配置管理、输出格式化。

### 事件总线 (`internal/events/`)

内部事件总线，实现 handler 和 service 之间的解耦通信。

### 日志 (`internal/logger/`)

基于 `slog` 的结构化日志，通过 `LOG_LEVEL` 环境变量控制级别（debug、info、warn、error）。

### 数据库

- PostgreSQL + pgvector 扩展（`pgvector/pgvector:pg17`）
- sqlc 从 `pkg/db/queries/` 中的 SQL 生成 Go 代码，输出到 `pkg/db/generated/`
- 迁移文件在 `migrations/` 目录

### 路由 (`cmd/server/router.go`)

- 公开路由：auth、health、websocket（无需认证）
- 受保护路由：需要 JWT
- Daemon 路由：无需认证，独立的认证模型

## 多租户

所有数据库查询按 `workspace_id` 过滤。成员资格检查控制访问权限。`X-Workspace-ID` 请求头指定请求所属的工作区。

## Agent 负责人

负责人是多态的 —— 可以是成员或 Agent。Issue 上通过 `assignee_type` + `assignee_id` 字段区分。Agent 在 UI 上有独特的样式（紫色背景 + 机器人图标）。

## 常用命令

### 一键启动

```bash
make setup            # 首次运行：确保共享 DB 存在、创建应用 DB、执行迁移
make start            # 同时启动后端 + 前端
make stop             # 停止当前 checkout 的所有进程
make db-down          # 停止共享的 PostgreSQL 容器
```

### 前端 (apps/web/)

```bash
pnpm install          # 安装依赖
pnpm dev:web          # 启动 Next.js 开发服务器（端口 3000）
pnpm build            # 构建生产版本
pnpm typecheck        # TypeScript 类型检查
pnpm lint             # ESLint 检查
pnpm test             # 运行 Vitest 测试
```

### 后端 (Go)

```bash
make dev              # 运行 Go 服务器（端口 8080）
make daemon           # 运行本地 daemon
make build            # 构建 server 和 CLI 二进制文件到 server/bin/
make cli ARGS="..."   # 运行 multica CLI（如 make cli ARGS="config"）
make test             # 运行 Go 测试
make sqlc             # 编辑 SQL 后重新生成 sqlc 代码
make migrate-up       # 执行数据库迁移
make migrate-down     # 回滚数据库迁移
```

### 运行单个测试

```bash
# 运行单个 Go 测试
cd server && go test ./internal/handler/ -run TestName

# 运行单个 TypeScript 测试
pnpm --filter @multica/web exec vitest run src/path/to/file.test.ts

# 运行单个 E2E 测试（需要先启动后端和前端）
pnpm exec playwright test e2e/tests/specific-test.spec.ts
```

### 数据库基础设施

```bash
make db-up            # 启动共享 PostgreSQL（pgvector/pg17 镜像）
make db-down          # 停止共享 PostgreSQL
```

## CI 环境要求

CI 运行在 Node 22 和 Go 1.26.1 上，使用 `pgvector/pgvector:pg17` PostgreSQL 服务。详见 `.github/workflows/ci.yml`。

## Worktree 支持

所有 git worktree 共享一个 PostgreSQL 容器。隔离在数据库层面实现 —— 每个 worktree 有自己的数据库名和唯一端口，通过 `.env.worktree` 配置。主 checkout 使用 `.env`。

```bash
make worktree-env       # 生成 .env.worktree（包含唯一的 DB 名和端口）
make setup-worktree     # 使用 .env.worktree 执行 setup
make start-worktree     # 使用 .env.worktree 启动
```

## 容器部署

通过 Docker Compose 部署，使用 `.env.container` 环境配置：

```bash
./scripts/deploy-container.sh
```

### 服务端口（222XX 范围）

| 服务 | 端口 |
|------|------|
| PostgreSQL | `localhost:22200` |
| 后端 API | `localhost:22201` |
| 前端 | `localhost:22202` |

### 认证信息

- 登录页：`admin@local` / `admin123`
- 注册页：http://localhost:22202/register

## API Rewrite 架构（重要）

Next.js 的 rewrite 在 Docker 容器**服务端**执行。浏览器永远不会直接访问后端主机名。

```
浏览器  →  /auth/login  (相对 URL)
前端容器  →  rewrite  →  http://backend:8080/auth/login
```

### 环境变量

| 变量 | 作用 |
|------|------|
| `NEXT_PUBLIC_API_URL` | 浏览器端使用（**必须留空**，让浏览器走相对路径） |
| `BACKEND_REWRITE_URL` | Next.js 服务端 rewrite 使用（Docker 内部主机名：`http://backend:8080`） |

> **常见错误**：设置 `NEXT_PUBLIC_API_URL=http://backend:8080` —— 这会把 Docker 内部主机名打包进客户端 JS，导致浏览器 `ERR_NAME_NOT_RESOLVED`。

## 容器部署操作

```bash
# 停止所有服务
docker compose -f docker-compose.yml --env-file .env.container down

# 重启服务（不重建）
docker compose -f docker-compose.yml --env-file .env.container up -d

# 重新构建并部署（代码修改后）
docker compose -f docker-compose.yml --env-file .env.container build --no-cache
docker compose -f docker-compose.yml --env-file .env.container up -d

# 查看日志
docker compose -f docker-compose.yml --env-file .env.container logs -f backend

# 手动执行数据库迁移
docker compose -f docker-compose.yml --env-file .env.container --profile migrate run --rm migrate
```

## Daemon 设置

本地 daemon 连接到容器部署的后端。首次部署或容器重启后需要执行以下步骤：

```bash
cd server

# 1. 配置服务端 URL（如尚未设置）
go run ./cmd/multica config set server_url http://localhost:22201

# 2. 认证（会打开浏览器进行 OAuth）
go run ./cmd/multica auth login

# 3. 监听工作区
go run ./cmd/multica workspace watch <workspace-id>

# 4. 启动 daemon
go run ./cmd/multica daemon start

# 查看 daemon 状态
go run ./cmd/multica daemon status

# 查看 daemon 日志
tail -f ~/.multica/daemon.log
```

> Daemon 配置文件位置：`~/.multica/config.json`

## 同步上游仓库

上游仓库地址：`multica-ai/multica`

### 一次性设置

```bash
git remote add upstream https://github.com/multica-ai/multica
```

### 拉取并合并上游更新

```bash
git fetch upstream main
git stash                              # 如有本地修改先暂存
git merge upstream/main                # 快进合并
git stash pop                          # 恢复本地修改，如有冲突则解决
```

如果 `pnpm-lock.yaml` 有冲突，重置并重新安装：

```bash
git checkout upstream/main -- pnpm-lock.yaml
pnpm install --no-frozen-lockfile
```

## 代码规范

- TypeScript 开启严格模式，类型必须显式声明
- Go 代码遵循标准规范（gofmt、go vet）
- **代码注释必须使用英文**
- 优先使用已有的模式/组件，而不是引入平行抽象
- 除非用户明确要求向后兼容，**禁止**添加兼容层、fallback 路径、双写逻辑、遗留适配器或临时垫片
- 如果某个流程或 API 正在被替换且产品尚未上线，**优先删除旧路径**，而不是保留新旧两份
- 兼容性代码是维护成本，不是默认的安全机制。避免"以防万一"的分支增加代码理解难度
- 除非任务需要，否则避免大规模重构

## UI/UX 规范

- 优先使用 shadcn 组件而非自定义实现。使用 `npx shadcn add` 安装缺失的组件
- **特性专属组件**放在 `features/<domain>/components/` 目录下
- 使用 shadcn 设计 token 进行样式（如 `bg-primary`、`text-muted-foreground`、`text-destructive`），**禁止**硬编码颜色值（如 `text-red-500`、`bg-gray-100`）
- 不引入额外状态（useState、context、reducer），除非设计明确要求。共享状态优先用 Zustand 而不是 React Context
- 特别注意 **overflow**（截断长文本、可滚动容器）、**对齐**和**间距**的一致性
- 对交互或状态设计有疑问时及时询问，用户会提供方向

## 测试规范

- **TypeScript**：Vitest 框架，只 mock 外部/第三方依赖
- **Go**：标准 `go test`，测试应在测试数据库中自行创建 fixture 数据

## 提交规范

- 使用原子提交，按逻辑意图分组
- 格式：

```
feat(scope): ...      # 新功能
fix(scope): ...       # 修复 bug
refactor(scope): ...  # 重构
docs: ...             # 文档
test(scope): ...      # 测试
chore(scope): ...     # 杂项
```

## CLI 发版

> **前提条件**：每次 Production 部署都必须伴随一个新版本的 CLI。

1. 在 `main` 分支打 tag：`git tag v0.x.x`
2. 推送 tag：`git push origin v0.x.x`
3. GitHub Actions 自动触发 `release.yml`：运行 Go 测试 → GoReleaser 构建多平台二进制 → 发布到 GitHub Releases + Homebrew tap

> 默认每次 patch 版本递增（如 `v0.1.12` → `v0.1.13`），除非指定其他版本号。

## 提交前最低检查

```bash
make check    # 运行全部检查：类型检查 + 单元测试 + Go 测试 + E2E
```

只有用户明确要求时才执行验证。

针对性检查（按需使用）：

```bash
pnpm typecheck        # 仅 TypeScript 类型检查
pnpm test             # 仅 TS 单元测试
make test             # 仅 Go 测试
pnpm exec playwright test   # 仅 E2E（需后端 + 前端运行）
```

## AI Agent 验证循环

写完或修改代码后，必须运行完整验证 pipeline：

```bash
make check
```

完整流程依次运行：
1. TypeScript 类型检查
2. TypeScript 单元测试
3. Go 测试
4. E2E 测试（必要时自动启动后端和前端）

**工作流：**
- 写代码满足需求
- 运行 `make check`
- 如果任何一步失败：读取错误输出、修复代码、重新运行
- 直到所有检查全部通过才视为完成

> **快速迭代**：如果确定只影响 TypeScript 或 Go，先跑单个检查更快，最后再跑完整 `make check`。

## E2E 测试模式

E2E 测试应该是自包含的。使用 `TestApiClient` fixture 进行数据准备和清理：

```typescript
import { loginAsDefault, createTestApi } from "./helpers";
import type { TestApiClient } from "./fixtures";

let api: TestApiClient;

test.beforeEach(async ({ page }) => {
  api = await createTestApi();       // 已登录的 API 客户端
  await loginAsDefault(page);         // 浏览器会话登录
});

test.afterEach(async () => {
  await api.cleanup();                // 删除测试中创建的数据
});

test("示例测试", async ({ page }) => {
  const issue = await api.createIssue("测试 Issue");   // 通过 API 创建
  await page.goto(`/issues/${issue.id}`);              // 通过 UI 测试
  // afterEach 中的 api.cleanup() 会删除该 issue
});
```
