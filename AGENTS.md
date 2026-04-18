# AGENTS.md — Agent 项目指南

本文件为 agent 提供**快速工作参考**。详细内容按需查阅下方文档索引。

---

## 工作准则

### Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands。所有浏览器任务必须跑在 subagent 里执行，严禁直接执行。

Core workflow: `open <url>` → `snapshot -i` → `click/fill` → 重新 snapshot

### 核心原则

1. **Plan Node Default** — 非平凡任务（3+ 步骤或架构决策）必须 Enter plan mode；遇到问题立即 STOP re-plan
2. **Subagent Strategy** — 大量使用 subagent 保持主 context 干净；复杂问题多分配 subagent
3. **Self-Improvement Loop** — 每次被纠正后更新 `tasks/lessons.md`，session 开始时回顾
4. **Verification Before Done** — 不证明工作就不标记完成；运行 `make check`
5. **Demand Elegance** — 非平凡变更先问"有没有更优雅的方式"；简单修复不要过度工程
6. **Autonomous Bug Fixing** — 修复 bug 尽量用 codeagent-wrapper codex subagent（gpt-5.4 最高级别）；零 hand-holding

### Task Management

1. Plan → `tasks/todo.md`（checkable items）→ 确认后再实施
2. 逐步标记完成，每步附简要说明
3. 完成后写 review section，纠正后更新 `tasks/lessons.md`

---

## 项目背景

**Multica** — AI 原生任务管理平台（类 Linear，AI Agent 是第一等公民）。目标用户：2-10 人 AI 原生团队。

## 团队成员映射

| Git 用户名 | 中文名+英文名 |
| --- | --- |
| wherexml | 许茂林 (Steve) |
| snowzh | SnowZh |
| joevic9 | 刘容舟 (Joe) |
| jjonakYu | 姚尚宇 (JJONAK) |
| Kevin-Kim0102 | 金天韵 (kevin) |
| hHuo07 | 宋媛焱 (Seren) |

> 来源：[wherexml/optimax](https://github.com/wherexml/optimax) 仓库协作者

## 技术架构

**Go 后端 + Next.js 前端。**

| 目录 | 技术栈 | 作用 |
| --- | --- | --- |
| `server/` | Go (Chi + sqlc + gorilla/websocket) | 后端 API |
| `apps/web/` | Next.js 16 (App Router) | 前端，完全自包含 |

> **详细架构** → [ARCHITECTURE.md](./ARCHITECTURE.md)（系统架构图、后端完整结构、前端 Store 依赖图、数据库 ER 图、事件系统、部署细节）

## 前端架构速查

三层特性优先架构：`app/`（路由层，薄壳）→ `features/`（业务模块）→ `shared/`（跨模块公共）

| 特性模块 | 职责 |
| --- | --- |
| `features/auth/` | 认证状态（`useAuthStore`、`AuthInitializer`） |
| `features/workspace/` | 工作区、成员、Agent（`useWorkspaceStore`） |
| `features/issues/` | Issue 状态与组件（`useIssueStore`） |
| `features/inbox/` | 收件箱通知（`useInboxStore`） |
| `features/realtime/` | WebSocket 连接（`WSProvider`、`useWSEvent`） |
| `features/modals/` | 弹窗注册与状态 |
| `features/skills/` | AI Skill 管理 |

**状态管理**：Zustand（全局） / React Context（仅生命周期） / useState（本地 UI）

**Store 规范**：每领域一个 store（selector 调用）；Store 禁止调用 hooks；依赖方向 `workspace → auth`、`realtime → auth`、`issues → workspace`（禁止反向）

**导入别名**：跨特性用 `@/`，同模块内用相对路径

**数据流**：`浏览器 → ApiClient → REST API → sqlc → PostgreSQL` / `浏览器 ← WSClient ← WebSocket ← Hub.Broadcast()`

> **完整前端文档** → [frontend.md](./frontend.md)

## 后端架构速查

| 目录 | 核心文件 | 职责 |
| --- | --- | --- |
| `cmd/server/` | `main.go`、`router.go` | 启动入口、路由定义 |
| `internal/handler/` | `<domain>.go` | 每域一个 handler |
| `internal/service/` | `task.go` | TaskService 编排 |
| `internal/realtime/` | `hub.go` | WebSocket Hub |
| `internal/events/` | `bus.go` | 内存 pub/sub |
| `pkg/agent/` | `claude.go` 等 | Agent Backend 接口 |
| `internal/daemon/` | `daemon.go` 等 | 本地 Agent 运行时 |

路由类型：Public（`/auth/*`、`/health`、`/ws`）/ Protected（`/api/*` JWT）/ Daemon（`/api/daemon/*`）

> **完整后端文档** → [backend.md](./backend.md)

## 多租户

所有查询按 `workspace_id` 过滤，`X-Workspace-ID` header 指定工作区。

## Agent 负责人

多态：成员或 Agent。`assignee_type` + `assignee_id` 区分。Agent UI 有紫色背景 + 机器人图标。

---

## 常用命令

```bash
# 一键启动
make setup            # 首次：DB + 迁移
make start            # 同时启动后端 + 前端
make stop             # 停止

# 前端
pnpm dev:web          # Next.js dev（端口 3000）
pnpm build / typecheck / lint / test

# 后端
make dev              # Go 服务器（端口 8080）
make test             # Go 测试
make sqlc             # SQL 改动后重新生成

# 数据库
make db-up / db-down  # PostgreSQL 容器
make migrate-up / migrate-down

# 单个测试
cd server && go test ./internal/handler/ -run TestName
pnpm --filter @multica/web exec vitest run src/path/to/file.test.ts
```

## 提交前检查

```bash
make check            # 全部：类型检查 + 单元测试 + Go 测试 + E2E
```

只有用户明确要求时才执行验证。快速迭代可先跑单步检查。

---

## 代码规范

- TypeScript 严格模式，Go 遵循 gofmt/go vet
- **代码注释必须使用英文**
- 优先使用已有模式/组件，不引入平行抽象
- **禁止**添加兼容层、fallback 路径、双写逻辑（除非用户明确要求）
- 提交格式：`feat(scope):` / `fix(scope):` / `refactor(scope):` / `docs:` / `test(scope):` / `chore(scope):`

## UI/UX 规范

- 优先 shadcn 组件（`npx shadcn add` 安装）
- 使用 shadcn design token（`bg-primary` 等），**禁止**硬编码颜色值
- 特性专属组件放 `features/<domain>/components/`
- 注意 overflow、对齐、间距一致性

## 测试规范

- **TypeScript**：Vitest，只 mock 外部/第三方依赖
- **Go**：标准 `go test`，自建 fixture 数据
- **E2E**：自包含，用 `TestApiClient` fixture 准备/清理数据

## CLI 发版

打 tag → push → GitHub Actions 自动构建：`git tag v0.x.x && git push origin v0.x.x`

---

## 文档索引（渐进式披露）

按需深入，避免一次加载所有信息：

| 文档 | 内容 |
| --- | --- |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 完整架构：系统图、后端结构、前端 Store 依赖图、数据库 ER、事件系统 |
| [frontend.md](./frontend.md) | 前端详细文档：组件体系、路由、状态管理、数据流 |
| [backend.md](./backend.md) | 后端详细文档：Handler/Service/EventBus/Agent SDK/Daemon |
| [database.md](./database.md) | 数据库：表结构、迁移、sqlc 用法 |
| [api_contract.md](./api_contract.md) | API 契约：REST + WebSocket 接口定义 |
| [design.md](./design.md) | 设计决策与 UI/UX 规范详解 |
| [deployment.md](./deployment.md) | 部署：Docker Compose、环境变量、端口配置 |
| [CLI_AND_DAEMON.md](./CLI_AND_DAEMON.md) | CLI 使用与 Agent Daemon 完整指南 |
| [CLI_INSTALL.md](./CLI_INSTALL.md) | CLI 安装指南（AI Agent 可执行版） |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 贡献流程：首次设置、开发工作流、worktree、测试 |
| [SELF_HOSTING.md](./SELF_HOSTING.md) | 自部署快速指南 |
| [SELF_HOSTING_ADVANCED.md](./SELF_HOSTING_ADVANCED.md) | 自部署高级配置（环境变量、TLS、OAuth） |
| [SELF_HOSTING_AI.md](./SELF_HOSTING_AI.md) | AI Agent 自部署指南（一键安装） |
| [DEPLOY_CONTAINER.md](./DEPLOY_CONTAINER.md) | 容器化部署指南（端口、环境变量、故障排除） |
| [local_modify.md](./local_modify.md) | 本地修改记录（相对上游的 diff） |

### 何时查阅哪个文档

| 场景 | 查阅 |
| --- | --- |
| 理解系统全貌 | ARCHITECTURE.md |
| 改前端代码 | frontend.md → ARCHITECTURE.md 的前端章节 |
| 改后端代码 | backend.md → ARCHITECTURE.md 的后端章节 |
| 改数据库 | database.md |
| 加/改 API | api_contract.md |
| 部署相关 | deployment.md → DEPLOY_CONTAINER.md |
| CLI/Daemon 问题 | CLI_AND_DAEMON.md |
| 查看本地功能增量（含 Sources / MCP） | local_modify.md |
| 上游同步 | local_modify.md |

---

## 开发环境端口偏好

**本地开发环境使用 Docker + OrbStack 部署，端口映射如下：**

| 服务 | 容器端口 | 宿主机端口 | 访问地址 |
| --- | --- | --- | --- |
| 前端 (Next.js) | 3000 | **22202** | http://localhost:22202 |
| 后端 (Go) | 8080 | **22201** | http://localhost:22201 |
| PostgreSQL | 5432 | **22200** | postgres://localhost:22200 |

**Docker 容器名称：**

- `multica-frontend-1` — 前端
- `multica-backend-1` — 后端
- `multica-postgres-1` — 数据库

**重要：** 测试登录或 API 时，使用 `http://localhost:22202` 访问前端，`http://localhost:22201` 直接访问后端。

**本地部署测试账号：**

- Email: `admin@local`
- Password: `admin123`

修改代码后需要重新部署：`docker compose up -d --build frontend` 或 `make start`

---

## CI 环境

Node 22 + Go 1.26.1，`pgvector/pgvector:pg17` PostgreSQL。详见 `.github/workflows/ci.yml`。

## Worktree 支持

共享 PostgreSQL 容器，DB 层面隔离。`make worktree-env` → `make setup-worktree` → `make start-worktree`

## 同步上游仓库

```bash
git remote add upstream https://github.com/multica-ai/multica  # 一次性
git fetch upstream main && git stash && git merge upstream/main && git stash pop
# pnpm-lock.yaml 冲突：git checkout upstream/main -- pnpm-lock.yaml && pnpm install --no-frozen-lockfile
```

## 本地修改记录

> 详见 [local_modify.md](./local_modify.md)。核心要点：

- 本地添加了**密码认证**（邮箱+密码登录/注册），上游用 Google OAuth + 验证码
- 登录页 `apps/web/app/(auth)/login/page.tsx` 是本地完全重写，**不要恢复为上游版本**
- 容器部署端口 222XX 范围，可能与上游不同
- `Sources / MCP` 数据源层也是本地增量，细节请直接看 `local_modify.md`
- 同步 `server/go.mod` 后需 `go get golang.org/x/crypto`

### 本地部署

本地通过 orb 的 docker 部署的 [部署地址：http://localhost:22202](http://localhost:22202/inbox)admin@local admin123 修改完了需要重新部署进行测试
