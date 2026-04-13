# 供应链决策 Demo 部署手册

这份手册面向本地演示环境，目标是在 OrbStack / Docker Compose 下把供应链决策 Demo 跑起来，并能完整演示“告警 → 决策 → 仿真 → 推荐 → 审批 → 执行 → 审计”闭环。

默认演示地址与端口：

- 前端：`http://localhost:22002`
- 后端：`http://localhost:22001`
- PostgreSQL：`localhost:22000`
- 演示账号：`admin@local / admin123`

> 当前分支已经包含 `server/migrations/seed_decisions.sql`，可以直接导入演示数据。这个 seed 文件会补充演示项目、连接器和覆盖多阶段状态的决策单数据。

## 1. 环境要求 (Prerequisites)

- Docker 或 OrbStack，且 `docker compose` 命令可用
- `pnpm >= 9`
- `Go >= 1.26`
- `Node >= 22`

推荐直接和仓库当前环境对齐：

- Node：`22`
- Go：`1.26.1`
- PostgreSQL 镜像：`pgvector/pgvector:pg17`
- pnpm：建议直接使用 `10.x`

快速检查：

```bash
docker --version
docker compose version
node -v
pnpm -v
go version
```

## 2. 快速启动 (Quick Start)

本仓库的 `Makefile` 在根目录，不在 `server/` 目录里。要按当前仓库真实结构启动，推荐直接使用下面这组命令。

```bash
# 1. Clone and enter project
git clone <repo> && cd multica

# 2. Install dependencies
pnpm install

# 3. Use demo env (22000 / 22001 / 22002)
cp .env.container .env

# 4. Start PostgreSQL
docker compose up -d postgres

# 5. Run migrations (including decision pipeline tables 040-046)
make migrate-up

# 6. Start backend
make server

# 7. Bootstrap demo user and workspace (only needed on a fresh database)
curl -X POST http://localhost:22001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@local","password":"admin123"}'

# 8. Seed demo data
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -f server/migrations/seed_decisions.sql

# 9. Start frontend (new terminal)
pnpm dev:web
```

启动完成后：

- 打开 `http://localhost:22002/login`
- 使用 `admin@local / admin123` 登录
- 登录成功后默认会跳到 `/issues`，也就是“决策单中心”

说明：

- `auth/register` 这一步在空库首次启动时必须执行，因为 seed 文件会把数据挂到“数据库中的第一条用户 / 第一条工作区”上
- 如果你本地数据库里已经有 `admin@local`，注册接口返回冲突时可以直接继续后面的 seed 步骤

如果你更想用 Compose 自带的一次性迁移容器，也可以用这组命令：

```bash
pnpm install
cp .env.container .env
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
```

## 3. Docker Compose 部署 (Docker Compose Deployment)

仓库根目录已经有可用的 `docker-compose.yml`。下面是按 Demo 端口整理后的完整配置，可直接作为手工部署参考。

```yaml
name: multica

services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: multica-postgres
    environment:
      POSTGRES_DB: multica
      POSTGRES_USER: multica
      POSTGRES_PASSWORD: multica
    ports:
      - "22000:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U multica -d multica"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - multica-network

  backend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VERSION: dev
        COMMIT: unknown
    container_name: multica-backend
    environment:
      PORT: 8080
      DATABASE_URL: postgres://multica:multica@postgres:5432/multica?sslmode=disable
      JWT_SECRET: change-me-demo
      FRONTEND_ORIGIN: http://localhost:22002
      CORS_ALLOWED_ORIGINS: http://localhost:22002
      LOG_LEVEL: info
      RESEND_API_KEY: ""
      RESEND_FROM_EMAIL: noreply@multica.ai
      GOOGLE_CLIENT_ID: ""
      GOOGLE_CLIENT_SECRET: ""
      GOOGLE_REDIRECT_URI: http://localhost:22002/auth/callback
      S3_BUCKET: ""
      S3_REGION: us-west-2
      CLOUDFRONT_KEY_PAIR_ID: ""
      CLOUDFRONT_PRIVATE_KEY_SECRET: multica/cloudfront-signing-key
      CLOUDFRONT_PRIVATE_KEY: ""
      CLOUDFRONT_DOMAIN: ""
      COOKIE_DOMAIN: ""
    ports:
      - "22001:8080"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - multica-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3

  frontend:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      args:
        NEXT_PUBLIC_API_URL: ""
        NEXT_PUBLIC_WS_URL: ws://localhost:22001/ws
        BACKEND_REWRITE_URL: http://backend:8080
    container_name: multica-frontend
    environment:
      PORT: 3000
      HOSTNAME: "0.0.0.0"
    ports:
      - "22002:3000"
    depends_on:
      - backend
    networks:
      - multica-network
    restart: unless-stopped

  migrate:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: multica-migrate
    command: ["./migrate", "up"]
    environment:
      DATABASE_URL: postgres://multica:multica@postgres:5432/multica?sslmode=disable
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - multica-network
    profiles:
      - migrate

volumes:
  pgdata:

networks:
  multica-network:
    driver: bridge
```

### 环境变量表

| 变量 | 示例值 | 用途 |
|------|--------|------|
| `POSTGRES_DB` | `multica` | 数据库名 |
| `POSTGRES_USER` | `multica` | 数据库用户 |
| `POSTGRES_PASSWORD` | `multica` | 数据库密码 |
| `POSTGRES_PORT` | `22000` | PostgreSQL 映射到宿主机的端口 |
| `DATABASE_URL` | `postgres://multica:multica@localhost:22000/multica?sslmode=disable` | 本地命令行和 `make migrate-up` 使用的连接串 |
| `BACKEND_PORT` | `22001` | 后端对外端口 |
| `PORT` | `8080` | 容器内 Go 服务监听端口 |
| `FRONTEND_PORT` | `22002` | 前端对外端口 |
| `FRONTEND_ORIGIN` | `http://localhost:22002` | 后端 CORS 与登录回跳来源 |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:22002` | 允许的前端来源 |
| `NEXT_PUBLIC_API_URL` | 空字符串或 `http://localhost:22001` | 浏览器端 API 基地址；本仓库可留空，用相对路径 |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:22001/ws` | 前端 WebSocket 地址 |
| `BACKEND_REWRITE_URL` | `http://backend:8080` | 容器内前端转发到后端的地址 |
| `JWT_SECRET` | 自定义随机串 | 登录态签名密钥 |
| `MULTICA_APP_URL` | `http://localhost:22002` | CLI / daemon 指向前端地址 |
| `MULTICA_SERVER_URL` | `ws://localhost:22001/ws` | CLI / daemon 指向后端地址 |

### Volume Mounts

| Volume | 挂载点 | 说明 |
|--------|--------|------|
| `pgdata` | `/var/lib/postgresql/data` | 持久化 PostgreSQL 数据 |

补充说明：

- `backend` 和 `frontend` 在 Compose 部署里使用镜像内置代码，不依赖宿主机 bind mount
- `migrate` 复用后端镜像，并使用镜像里打包进去的 `migrations/`

### 全容器启动命令

如果你要完整走一遍 Compose 部署而不是本地分别起前后端，推荐顺序如下：

```bash
cp .env.container .env
docker compose build
docker compose up -d postgres
docker compose --profile migrate run --rm migrate
docker compose up -d backend frontend
docker compose ps
```

## 4. 数据库初始化 (Database Initialization)

### 决策链路迁移清单

| 版本 | 文件 | 作用 |
|------|------|------|
| `040` | `server/migrations/040_decision_case.up.sql` | 创建 `decision_case`，把普通 issue 扩展成决策单 |
| `041` | `server/migrations/041_decision_snapshots.up.sql` | 创建 `decision_context_snapshot`，记录诊断/告警/指标快照 |
| `042` | `server/migrations/042_scenarios.up.sql` | 创建 `scenario_run`、`scenario_option`，支撑仿真与备选方案 |
| `043` | `server/migrations/043_recommendations_approvals_actions.up.sql` | 创建 `decision_recommendation`、`decision_approval`、`action_run` |
| `044` | `server/migrations/044_connectors.up.sql` | 创建 `connector`，并给 `action_run.connector_id` 建立外键 |
| `045` | `server/migrations/045_runtime_executor.up.sql` | 创建 `runtime_executor`，补充执行环境能力元数据 |
| `046` | `server/migrations/046_audit_event.up.sql` | 创建 `audit_event`，并用 trigger 保证审计事件不可修改/删除 |

### 初始化顺序

```bash
# 1. Start DB
docker compose up -d postgres

# 2. Apply all migrations
make migrate-up

# 3. Start backend
make server

# 4. Bootstrap the first user/workspace on a fresh DB
curl -X POST http://localhost:22001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@local","password":"admin123"}'

# 5. Seed demo data
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -f server/migrations/seed_decisions.sql
```

### 如何验证迁移已经生效

先看迁移记录：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica \
  -c "SELECT version, applied_at FROM schema_migrations WHERE version BETWEEN '040_decision_case' AND '046_audit_event' ORDER BY version;"
```

再看核心表是否存在：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica \
  -c "\\dt decision_case decision_context_snapshot scenario_run scenario_option decision_recommendation decision_approval action_run connector runtime_executor audit_event"
```

也可以快速查一下数据量：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica \
  -c "SELECT COUNT(*) FROM decision_case;"
```

### 关于 seed 数据

当前 seed 文件路径：

```bash
server/migrations/seed_decisions.sql
```

当前分支内，这个文件已经存在，且内容会补充：

- 演示项目
- 演示连接器
- 10 条覆盖不同生命周期阶段的决策单
- 相关快照、仿真、推荐、审批、执行、审计数据

使用前提：

- 数据库里必须已经有至少一个 `user`
- 这个 `user` 首次登录 / 注册后会自动带出第一个 `workspace`
- seed 文件会把演示数据挂到这个“第一条用户 + 第一条工作区”上

导入命令：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -f server/migrations/seed_decisions.sql
```

如果你本地拉下来的代码缺这个文件，再单独检查：

```bash
ls server/migrations/seed_decisions.sql
```

导入完成后，建议至少确认下面这几个数量：

- `decision_case`：`10`
- `connector`：至少 `1`
- `project`：至少 `1`

## 5. 端口配置 (Port Mapping)

| Service | Internal Port | External Port | URL |
|---------|---------------|---------------|-----|
| PostgreSQL | `5432` | `22000` | `localhost:22000` |
| Backend API | `8080` | `22001` | `http://localhost:22001` |
| Frontend | `3000` | `22002` | `http://localhost:22002` |

常用健康检查：

```bash
curl http://localhost:22001/health
open http://localhost:22002
```

## 6. 演示流程 (Demo Walkthrough)

下面这套脚本适合在中文演示里直接照着走。

### 1) 登录工作台

1. 打开 `http://localhost:22002/login`
2. 输入账号 `admin@local`
3. 输入密码 `admin123`
4. 登录后默认进入 `/issues`，也就是“决策单中心”

### 2) 查看异常告警 → 生成决策单

1. 从左侧导航进入“工作台”（`/inbox`）
2. 在异常告警区域找到一条库存、供应延迟或预测偏差告警
3. 打开告警详情
4. 触发“生成决策单”
5. 系统会调用 `POST /api/tower/alerts/{alertId}/decision`
6. 生成后的决策单会出现在“决策单中心”

### 3) 诊断分析 → 运行仿真

1. 进入目标决策单详情页
2. 在“诊断”页签触发诊断
3. 系统写入一条快照，并把阶段推进到 `diagnosing`
4. 再在“仿真”页签运行场景
5. 系统创建 `scenario_run` 和多条 `scenario_option`

### 4) 查看推荐方案

1. 进入“推荐”页签
2. 查看系统给出的推荐标题、理由、预期影响和置信度
3. 确认推荐方案已经关联到当前决策单

### 5) 提交审批 → 通过 / 驳回

1. 在“审批”页签提交审批流
2. 演示人选择一个审批人
3. 提交后决策状态会进入 `awaiting_approval`
4. 使用对应审批人身份执行“通过”或“驳回”
5. “通过”会把决策推进到 `approved`
6. “驳回”会把状态退回推荐阶段，便于重新调整方案

### 6) 执行动作 → 查看审计链

1. 在“执行”页签发起动作执行
2. 演示动作落到 `action_run`
3. 如有需要，再演示回滚
4. 最后打开“审计链”页签
5. 依次查看 `decision.created`、`decision.diagnosed`、`scenario.created`、`decision.recommended`、`approval.submitted`、`approval.approved/rejected`、`action.executed` 等事件

建议演示顺序：

- 工作台：展示“为什么需要做决策”
- 决策单中心：展示“有哪些待处理决策”
- 详情八个 Tab：展示“这个决策如何被分析、审批、执行和审计”
- 执行环境 / 专家网络 / 技能包：作为扩展说明，展示平台可扩展性

## 7. API 端点清单 (Decision Pipeline API Endpoints)

所有下面这些接口都属于当前仓库已经接入路由的真实路径。除登录接口外，调用时都需要：

- `Authorization: Bearer <token>`
- `X-Workspace-ID: <workspace_id>`

### 决策单 CRUD

- `GET /api/decisions`
- `POST /api/decisions`
- `GET /api/decisions/{id}`
- `PATCH /api/decisions/{id}`

### 诊断 / 场景仿真

- `POST /api/decisions/{id}/diagnose`
- `POST /api/decisions/{id}/scenarios/run`
- `GET /api/decisions/{id}/scenarios`

### 推荐

- `POST /api/decisions/{id}/recommend`
- `GET /api/decisions/{id}/recommendations`

### 审批

- `POST /api/decisions/{id}/submit-approval`
- `GET /api/decisions/{id}/approvals`
- `POST /api/approvals/{approvalId}/approve`
- `POST /api/approvals/{approvalId}/reject`

### 动作执行

- `POST /api/decisions/{id}/execute`
- `GET /api/decisions/{id}/actions`
- `GET /api/actions/{actionId}`
- `POST /api/actions/{actionId}/rollback`

### 审计

- `GET /api/decisions/{id}/audit-trail`
- `GET /api/audit/events`
- `GET /api/audit/events/{eventId}`

### 控制塔告警

- `GET /api/tower/alerts`
- `POST /api/tower/alerts/{alertId}/decision`

### 指标快照

- `GET /api/metrics/snapshots`

### 连接器

- `GET /api/connectors`
- `POST /api/connectors`
- `GET /api/connectors/{connectorId}`
- `PATCH /api/connectors/{connectorId}`
- `POST /api/connectors/{connectorId}/test`

### 登录相关（演示环境常用）

- `POST /auth/register`
- `POST /auth/login`

## 8. 故障排除 (Troubleshooting)

### 1) `.next` 缓存导致页面异常

现象：

- 页面白屏
- 编译引用旧页面
- `validator.ts` 里出现不存在的路由引用

处理：

```bash
rm -rf apps/web/.next
pnpm dev:web
```

### 2) 端口冲突

现象：

- `22000` / `22001` / `22002` 端口被占用
- Compose 无法启动

处理：

```bash
lsof -i :22000
lsof -i :22001
lsof -i :22002
```

如果确认有旧进程或旧容器占用，先停掉再重启：

```bash
docker compose down
docker compose up -d postgres
```

### 3) 迁移失败

现象：

- `make migrate-up` 报数据库连接错误
- `schema_migrations` 没有写入新版本

处理：

```bash
docker compose ps postgres
docker compose logs postgres
curl http://localhost:22001/health
```

然后手工验证数据库连接：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -c "SELECT now();"
```

如果你用的是根目录 `.env`，也确认里面是 222xx 端口：

```bash
cat .env | grep -E 'POSTGRES_PORT|BACKEND_PORT|FRONTEND_PORT|DATABASE_URL'
```

### 4) CORS 错误

现象：

- 浏览器里请求被拦截
- 登录后接口报跨域

处理：

确认这几个值一致：

```bash
grep -E 'FRONTEND_ORIGIN|CORS_ALLOWED_ORIGINS|NEXT_PUBLIC_WS_URL' .env
```

Demo 环境建议至少是：

```env
FRONTEND_ORIGIN=http://localhost:22002
CORS_ALLOWED_ORIGINS=http://localhost:22002
NEXT_PUBLIC_WS_URL=ws://localhost:22001/ws
```

### 5) 后端起不来，前端能打开但没有数据

处理：

```bash
make server
curl http://localhost:22001/health
```

如果后端是容器方式运行，则看日志：

```bash
docker compose logs -f backend
```

### 6) 执行了 seed，但页面里没有演示数据

最常见原因：

- 你在空库里直接执行了 seed，但当时还没有用户和工作区

处理：

```bash
# 1. 先启动后端
make server

# 2. 先注册管理员
curl -X POST http://localhost:22001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@local","password":"admin123"}'

# 3. 再重新导入 seed
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -f server/migrations/seed_decisions.sql
```

然后再次确认：

```bash
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -c "SELECT COUNT(*) FROM decision_case;"
```

### 7) seed 文件不存在

现象：

- 执行 `psql -f server/migrations/seed_decisions.sql` 时报文件不存在

处理：

```bash
ls server/migrations/seed_decisions.sql
```

如果文件不存在，通常说明当前分支没有同步到最新演示数据。此时有两个选择：

- 先只跑迁移，手动注册账号并创建测试数据
- 拉取包含 `server/migrations/seed_decisions.sql` 的最新分支后再导入

### 8) 登录失败

现象：

- `admin@local / admin123` 无法登录

处理：

先确认当前数据库里是否已有该账号。如果没有，可以直接走注册：

```bash
curl -X POST http://localhost:22001/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@local","password":"admin123"}'
```

然后再回到前端登录页重新登录。

## 附：最实用的检查命令

```bash
# 服务状态
docker compose ps

# 数据库迁移版本
PGPASSWORD=multica psql -h localhost -p 22000 -U multica -d multica -c "SELECT version FROM schema_migrations ORDER BY version;"

# 后端健康检查
curl http://localhost:22001/health

# 前端地址
open http://localhost:22002
```
