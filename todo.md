# Multica 供应链 Demo 深改待办总表（todo.md）

## 使用方式

本文件按 Harness-Friendly 方式组织，适合直接交给 CodeX / Codex 类代理执行。

### 任务块约定

每个任务都包含以下固定字段：

- `id`：唯一任务编号
- `priority`：P0 / P1 / P2
- `kind`：frontend / backend / database / api / design / qa / deployment
- `depends_on`：依赖任务 ID
- `scope`：必须修改的目录或文件
- `deliverables`：需要产出的代码/文档/迁移/API
- `acceptance`：可验证结果
- `verify`：本地验证命令
- `rollback`：回滚方式

### 执行总原则

1. 先修基线，再做语义扩展：优先修复现有仓库断点，再新增供应链语义层。
2. 保留底座对象：`workspace / project / issue / agent / runtime / skill` 不推翻，使用 sidecar 方式扩展。
3. 先中文化与业务语义统一，再补审批/执行/连接器。
4. 所有新增写操作必须有审计、幂等、回滚定义。
5. 控制面只存工作流元数据，事实数据仍留在 ERP / OMS / WMS / DWH。

---

## 里程碑拆分

| 里程碑 | 目标 | 对应任务 |
|---|---|---|
| M0 基线修复 | 修复现有断点，建立可重复验证基线 | BASE-P0-001 ~ 003 |
| M1 中文化与语义改名 | 完成 zh-CN 默认交付、导航和核心对象改名 | I18N-P0-004 ~ 006 |
| M2 决策闭环前端 | 决策单中心、详情八 Tab、专题中心、控制塔 | FE-P0-007 ~ 013 |
| M3 决策闭环后端 | 决策对象、仿真、审批、动作执行、连接器 | DB/BE-P0/P1-014 ~ 023 |
| M4 演示加固 | 种子数据、E2E、部署、运维治理 | QA/DEP-P1-024 ~ 027 |

---

## 任务清单

## BASE-P0-001 修复 Projects API 路由缺失

```yaml
id: BASE-P0-001
priority: P0
kind: backend
depends_on: []
scope:
  - server/cmd/server/router.go
  - server/internal/handler/project.go
deliverables:
  - /api/projects 路由注册
  - GET/POST/PUT/DELETE 基线可用
```

### 目标
当前仓库已存在 `project.go` handler，但路由层未暴露 `/api/projects`。先修复这个断点，避免“专题中心”前后端天然失配。

### 实施步骤
1. 在 `server/cmd/server/router.go` 注册 `/api/projects` 路由组。
2. 对齐权限中间件：
   - `GET /api/projects`
   - `POST /api/projects`
   - `GET /api/projects/{id}`
   - `PUT /api/projects/{id}`
   - `DELETE /api/projects/{id}`
3. 若已有前端依赖 `project_id` 查询 issue，补充联调测试。
4. 确认 workspace 作用域隔离生效。

### 验收
- `Projects` 列表页不再因 404/501 空转。
- 新建、编辑、删除专题全链路可用。
- `issue.project_id` 关联查询正常。

### 验证
```bash
cd server && go test ./...
cd server && go build ./cmd/server
curl -sS http://localhost:8080/api/projects -H "Authorization: Bearer <TOKEN>" -H "X-Workspace-ID: <WS_ID>"
```

### 回滚
```bash
git checkout -- server/cmd/server/router.go
```

---

## BASE-P0-002 建立基线冒烟清单与改造分支保护

```yaml
id: BASE-P0-002
priority: P0
kind: qa
depends_on: [BASE-P0-001]
scope:
  - package.json
  - apps/web/package.json
  - docs/internal/smoke-checklist.md
deliverables:
  - 冒烟检查清单
  - 本地验证顺序
  - pre-merge checklist
```

### 目标
所有后续任务都必须建立在可重复执行的基线之上，避免“改一处炸三处”。

### 实施步骤
1. 新建内部冒烟清单，覆盖：
   - 登录
   - 工作空间切换
   - Issues 列表/详情
   - Projects 列表/详情
   - Agents / Runtimes / Skills / Settings
2. 固定验证顺序：
   - `pnpm lint`
   - `pnpm test`
   - `pnpm typecheck`
   - `pnpm --filter @multica/web build`
   - `cd server && go test ./...`
3. 在 PR 模板中加入“是否影响 API / migration / i18n / 路由”的勾选项。

### 验收
- 任一任务完成后可按同一顺序回归。
- 新增 migration、API、UI 改动均有对应回归点。
- 不再依赖人工记忆判断是否“差不多能跑”。

### 验证
```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm --filter @multica/web build
cd server && go test ./...
```

### 回滚
删除新增清单文件与 PR 模板修改。

---

## BASE-P0-003 冻结语义映射与命名词典

```yaml
id: BASE-P0-003
priority: P0
kind: design
depends_on: [BASE-P0-001]
scope:
  - design.md
  - apps/web/messages/*
  - packages/core/platform/lexicon.ts
deliverables:
  - 词典层
  - 命名映射基线
```

### 目标
在开始中文化之前先冻结业务名称，避免同一个对象出现多种中文名称。

### 验收
- `design.md` 以当前仓库 UI 结构为准，不再写成泛化产品蓝图。
- 完成以下唯一映射：
  - Workspace → 业务空间
  - Project → 项目 / 专题
  - Issue → 决策单
  - Agent → 专家 Agent
  - Runtime → 执行环境
  - Skill → 技能包
  - Comment → 协同记录
  - Run Messages → 执行轨迹
- 业务名词只允许通过词典层输出，不允许在页面组件里再次硬编码。

### 验证
人工检查所有核心页面，确认不存在“Issue/决策单”“Task/待办”“Project/专题”混用。

### 回滚
回退词典层与消息包文件。

---

## I18N-P0-004 引入 zh-CN 默认的 i18n 骨架

```yaml
id: I18N-P0-004
priority: P0
kind: frontend
depends_on: [BASE-P0-003]
scope:
  - apps/web/app/layout.tsx
  - apps/web/components/locale-sync.tsx
  - apps/web/messages/zh-CN/*.json
  - apps/web/messages/en-US/*.json
  - packages/core/platform/i18n/*
deliverables:
  - zh-CN 默认语言
  - en-US 回退语言
  - message loader
  - locale 规范化兼容层
```

### 目标
把当前仅有的 locale scaffold 升级为可交付的文案体系。

### 实施步骤
1. 引入消息加载层（`next-intl` 或等价方案）。
2. 保留当前 root layout 不直接依赖 `cookies()` 的模式，通过 `locale-sync.tsx` 与客户端状态同步 `<html lang>`。
3. 读取顺序：
   - 用户设置
   - 业务空间默认语言
   - `multica-locale` cookie
4. 兼容旧值并规范化写回：
   - `zh` -> `zh-CN`
   - `en` -> `en-US`
5. 默认值固定为 `zh-CN`，不要跟随浏览器自动切英文。
6. 缺失文案时回退到英文 key display。

### 验收
- 首次进入页面即为中文。
- `multica-locale=zh` 与 `multica-locale=zh-CN` 都能正确落到中文。
- `multica-locale=en` 与 `multica-locale=en-US` 都能正确落到英文。
- 语言切换后无需刷新即可生效。
- 中英文消息包可并存。

### 验证
```bash
pnpm --filter @multica/web typecheck
pnpm --filter @multica/web test
pnpm --filter @multica/web build
```

### 回滚
```bash
git checkout -- apps/web/app/layout.tsx apps/web/components/locale-sync.tsx apps/web/messages packages/core/platform
```

---

## I18N-P0-005 侧边导航改为 labelKey 驱动

```yaml
id: I18N-P0-005
priority: P0
kind: frontend
depends_on: [I18N-P0-004]
scope:
  - packages/views/layout/app-sidebar.tsx
  - apps/web/messages/zh-CN/navigation.json
  - apps/web/messages/en-US/navigation.json
deliverables:
  - sidebar labelKey 化
  - 中文导航
```

### 目标
把当前硬编码英文导航改成术语词典驱动。

### 目标导航
- `/inbox` → 工作台 / 待办与告警
- `/my-issues` → 我的待办
- `/issues` → 决策单中心
- `/projects` → 专题中心
- `/agents` → 专家 Agent
- `/runtimes` → 执行环境
- `/skills` → 技能包
- `/settings` → 平台设置

### 验收
- `app-sidebar.tsx` 不再出现业务标签硬编码。
- 中英文切换后导航即时变化。
- `Runtimes` 的更新红点逻辑不受影响。

### 验证
```bash
pnpm --filter @multica/web test
pnpm --filter @multica/web build
```

### 回滚
```bash
git checkout -- packages/views/layout/app-sidebar.tsx apps/web/messages
```

---

## I18N-P0-006 设置页全面中文化

```yaml
id: I18N-P0-006
priority: P0
kind: frontend
depends_on: [I18N-P0-004]
scope:
  - packages/views/settings/components/settings-page.tsx
  - packages/views/settings/components/*
deliverables:
  - 设置页文案消息化
  - 平台设置语义重命名
```

### 目标
把 `Settings / My Account / Profile / Appearance / API Tokens / General / Repositories / Members` 全量收口到消息包。

### 验收
- 设置页文案中文覆盖率 ≥ 95%。
- 工作空间组命名支持显示“业务空间”。
- 为后续新增 `连接器 / 语言 / 审批 / 审计` 预留 tabs 区域。

### 验证
```bash
pnpm --filter @multica/web typecheck
pnpm --filter @multica/web build
```

### 回滚
回退 `packages/views/settings/components/*`。

---

## FE-P0-007 Inbox 改造成工作台 / 待办与告警中心

```yaml
id: FE-P0-007
priority: P0
kind: frontend
depends_on: [I18N-P0-005]
scope:
  - packages/views/inbox/components/inbox-page.tsx
  - packages/views/inbox/components/*
  - apps/web/app/(dashboard)/inbox/*
deliverables:
  - 告警列表
  - 待审批入口
  - 在途决策区块
```

### 目标
复用现有 inbox 作为“工作台”入口，不立即改路径，优先改语义和内容结构。

### 功能要求
1. 顶部四区块：
   - 待办
   - 异常告警
   - 待审批
   - 在途决策
2. 告警卡可一键“生成决策单”。
3. 支持按业务域 / 仓 / 区域 / 商品 / 风险等级筛选。
4. 保留现有已读/归档基础能力。

### 验收
- `/inbox` 进入后看到的是业务工作台，而不是消息盒子。
- 点击告警可跳转创建决策单草稿。
- 现有归档/已读能力仍可用。

### 验证
```bash
pnpm --filter @multica/web test
pnpm --filter @multica/web build
```

### 回滚
回退 inbox 组件和 dashboard route 文件。

---

## FE-P0-008 Issues 列表改造成决策单中心

```yaml
id: FE-P0-008
priority: P0
kind: frontend
depends_on: [I18N-P0-005]
scope:
  - packages/views/issues/components/issues-page.tsx
  - packages/views/issues/components/issues-header.tsx
  - packages/views/issues/components/list-view.tsx
  - packages/views/issues/components/board-view.tsx
deliverables:
  - 决策单中心列表
  - 业务过滤器
  - 列表/看板双视图
```

### 目标
继续复用 issue 列表与 board/list 结构，但把过滤器扩展为供应链业务视图。

### 新增过滤维度
- `phase`
- `risk_level`
- `execution_mode`
- `decision_type`
- `object_type`
- `project_id`
- `assignee_type`
- `warehouse_id / region_id / sku_id`（P1 可以先落在扩展字段）

### 验收
- 列表页标题、空状态、筛选器、批量操作都切换为决策语义。
- “无数据”空态文案不再出现 Issue 字样。
- 列表视图可直接看到风险等级、执行模式、阶段。

### 验证
```bash
pnpm --filter @multica/web test
pnpm --filter @multica/web build
```

### 回滚
回退 `packages/views/issues/components/*` 相关文件。

---

## FE-P0-009 Issue 详情改造成八 Tab 决策单详情

```yaml
id: FE-P0-009
priority: P0
kind: frontend
depends_on: [FE-P0-008, BE-P0-016]
scope:
  - packages/views/issues/components/issue-detail.tsx
  - packages/views/issues/components/*
  - packages/views/decisions/components/*
deliverables:
  - 详情八 Tab
  - 诊断/仿真/推荐/审批/执行 UI 容器
```

### 目标
保留现有 issue detail 的成熟交互（标题、状态、优先级、子任务、Activity、Pin、复制链接），但把业务主轴切到决策流程。

### 详情页八 Tab
1. 概览
2. 指标快照
3. 诊断分析
4. 场景仿真
5. 推荐方案
6. 审批流
7. 动作执行
8. 协同记录 / 执行轨迹

### 实施约束
- 不允许继续把所有业务逻辑塞进一个超大 `issue-detail.tsx`。
- 必须拆成 tab 级子组件。
- 原有 Activity / 子任务 / Pin 能力保留。

### 验收
- 详情主操作路径完整：诊断 → 仿真 → 推荐 → 审批 → 执行 → 复盘。
- 每个 Tab 至少有 loading / empty / error / success 四态。
- 旧 issue 属性仍可用于协作态管理。

### 验证
```bash
pnpm --filter @multica/web test
pnpm --filter @multica/web build
```

### 回滚
回退 issue detail 及新增 decisions 组件目录。

---

## FE-P0-010 Projects 改造成专题中心

```yaml
id: FE-P0-010
priority: P0
kind: frontend
depends_on: [BASE-P0-001, FE-P0-008]
scope:
  - packages/views/projects/components/projects-page.tsx
  - packages/views/projects/components/project-detail.tsx
  - packages/views/projects/components/*
deliverables:
  - 专题列表
  - 专题详情总览
  - 专题与决策单关联视图
```

### 目标
把项目对象从工程项目语义切换为供应链治理专题。

### 推荐专题模板
- 爆品保供
- 区域库存平衡
- 供应商风险管理
- 预测修正专项

### 验收
- 专题详情页能看到专题摘要、目标指标、关联决策单。
- 支持专题维度的状态和优先级。
- 保留 issue board/list 的复用能力。

### 验证
```bash
pnpm --filter @multica/web build
curl -sS http://localhost:8080/api/projects -H "Authorization: Bearer <TOKEN>" -H "X-Workspace-ID: <WS_ID>"
```

### 回滚
回退 `packages/views/projects/components/*`。

---

## FE-P1-011 Agents 改造成专家网络

```yaml
id: FE-P1-011
priority: P1
kind: frontend
depends_on: [FE-P0-009, BE-P1-021]
scope:
  - packages/views/agents/components/*
deliverables:
  - 专家 Agent 视图
  - 能力域标签
  - 最近质量 / 成功率展示
```

### 目标
Agent 不能只是头像卡；要展示业务角色、技能包绑定、运行约束和近期质量。

### 验收
- Agent 列表至少可按业务域、状态、绑定执行环境筛选。
- 详情页显示：
  - 领域描述
  - 输入依赖
  - 绑定技能包
  - 可用执行环境
  - 审批约束
  - 最近运行结果

### 验证
```bash
pnpm --filter @multica/web build
```

### 回滚
回退 agents 组件目录。

---

## FE-P1-012 Runtimes 改造成执行环境管理

```yaml
id: FE-P1-012
priority: P1
kind: frontend
depends_on: [BE-P1-021]
scope:
  - packages/views/runtimes/components/*
deliverables:
  - executor_kind 展示
  - 网络区 / 凭证范围 / 允许动作展示
```

### 目标
把当前偏向本地 CLI daemon 的 runtime 详情扩展为通用执行器管理界面。

### 必显字段
- `executor_kind`
- `runtime_mode`
- `network_zone`
- `credential_scope`
- `allowed_actions`
- `approval_required`
- 健康状态 / 最近心跳 / 用量

### 验收
- Runtime 详情页不再只围绕 CLI Version / Token Usage。
- 支持区分 LLM / SQL / Python / Optimizer / Connector Runtime。
- 可以看清“该执行环境允许做什么、不允许做什么”。

### 验证
```bash
pnpm --filter @multica/web build
```

### 回滚
回退 runtimes 组件目录。

---

## FE-P1-013 Skills 改造成技能包管理

```yaml
id: FE-P1-013
priority: P1
kind: frontend
depends_on: [BE-P1-020]
scope:
  - packages/views/skills/components/*
deliverables:
  - 技能包版本
  - 输入输出 schema 展示
  - 评测结果 / 发布 / 回滚信息
```

### 目标
技能包必须从“文件集合”升级为“可治理、可发布、可评测”的能力单元。

### 验收
- 技能包列表至少可见版本号、绑定 Agent、适用业务域。
- 技能包详情可见：
  - 输入 schema
  - 输出 schema
  - 依赖连接器
  - 最近评测结果
  - 发布状态
  - 回滚说明

### 验证
```bash
pnpm --filter @multica/web build
```

### 回滚
回退 skills 组件目录。

---

## DB-P0-014 新增 decision_case 核心扩展表

```yaml
id: DB-P0-014
priority: P0
kind: database
depends_on: [BASE-P0-001]
scope:
  - server/migrations/040_decision_case.up.sql
  - server/migrations/040_decision_case.down.sql
deliverables:
  - decision_case 表
  - phase / risk / execution_mode 状态字段
```

### 目标
用 sidecar 方式给 `issue` 补充供应链决策语义，不破坏现有 issue 协作对象。

### 表要求
- 主键：`issue_id`
- 关联：`workspace_id`, `project_id`
- 核心字段：
  - `domain`
  - `decision_type`
  - `object_type`
  - `object_id`
  - `objective`
  - `constraints`
  - `risk_level`
  - `execution_mode`
  - `phase`
  - `approval_status`
  - `execution_status`

### 验收
- migration 可重复执行。
- 不影响现有 issue 表数据。
- 能支持列表页的新增过滤维度。

### 验证
```bash
cd server && go test ./...
# 本地数据库执行 migrate up/down 各一次
```

### 回滚
执行对应 down migration。

---

## DB-P0-015 新增快照 / 仿真 / 推荐 / 审批 / 动作 / 连接器表

```yaml
id: DB-P0-015
priority: P0
kind: database
depends_on: [DB-P0-014]
scope:
  - server/migrations/041_decision_snapshots.up.sql
  - server/migrations/042_scenarios.up.sql
  - server/migrations/043_recommendations_approvals_actions.up.sql
  - server/migrations/044_connectors.up.sql
deliverables:
  - decision_context_snapshot
  - scenario_run / scenario_option
  - decision_recommendation
  - decision_approval
  - action_run
  - connector
```

### 目标
补齐完整决策闭环所需的数据模型。

### 验收
- 各表外键明确。
- 写操作可追踪到 issue / workspace / actor / runtime / connector。
- `action_run.idempotency_key` 唯一索引存在。
- `scenario_run` 与 `snapshot_id` 强绑定。

### 验证
```bash
cd server && go test ./...
# 本地数据库执行 migrate up/down 各一次
```

### 回滚
执行对应 down migration。

---

## BE-P0-016 决策单 API 与服务层

```yaml
id: BE-P0-016
priority: P0
kind: backend
depends_on: [DB-P0-014, DB-P0-015]
scope:
  - server/cmd/server/router.go
  - server/internal/handler/decision.go
  - server/internal/service/decision/*
  - server/pkg/db/queries/decision.sql
deliverables:
  - GET/POST/PATCH /api/decisions
  - GET /api/decisions/{id}
  - issue + decision_case 聚合查询
```

### 目标
建立 `issue` 与 `decision_case` 的聚合读写层，避免前端自行拼接多个接口。

### 验收
- 决策单列表支持 phase / risk / execution_mode / project / object 查询。
- 单条详情返回 issue 协作字段 + decision 扩展字段 + 最新快照/推荐/审批摘要。
- 旧 issue 接口仍兼容存在。

### 验证
```bash
cd server && go test ./...
curl -sS http://localhost:8080/api/decisions -H "Authorization: Bearer <TOKEN>" -H "X-Workspace-ID: <WS_ID>"
```

### 回滚
回退 decision handler/service/query 与路由注册。

---

## BE-P1-017 诊断与场景仿真编排

```yaml
id: BE-P1-017
priority: P1
kind: backend
depends_on: [BE-P0-016]
scope:
  - server/internal/handler/scenario.go
  - server/internal/service/scenario/*
  - server/pkg/db/queries/scenario.sql
deliverables:
  - POST /api/decisions/{id}/diagnose
  - POST /api/decisions/{id}/scenarios/run
  - GET /api/decisions/{id}/scenarios
```

### 目标
把 Agent 诊断与多方案仿真编排成后端能力，而不是让前端直接拼工具调用。

### 验收
- 诊断启动后会记录执行轨迹。
- 仿真 run 有 `queued / running / succeeded / failed` 状态。
- 仿真结果至少支持三个并列候选方案。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 scenario handler/service/query。

---

## BE-P1-018 推荐方案与审批状态机

```yaml
id: BE-P1-018
priority: P1
kind: backend
depends_on: [BE-P1-017]
scope:
  - server/internal/handler/recommendation.go
  - server/internal/handler/approval.go
  - server/internal/service/recommendation/*
  - server/internal/service/approval/*
deliverables:
  - POST /api/decisions/{id}/recommend
  - POST /api/decisions/{id}/submit-approval
  - POST /api/approvals/{id}/approve
  - POST /api/approvals/{id}/reject
```

### 目标
把“推荐”和“审批”从页面按钮提升为带状态机的后端能力。

### 状态机要求
- `decision_case.phase`：
  - `identified`
  - `diagnosing`
  - `simulating`
  - `recommending`
  - `awaiting_approval`
  - `approved`
  - `executing`
  - `monitoring`
  - `closed`
- `approval_status`：
  - `draft`
  - `pending`
  - `approved`
  - `rejected`
  - `cancelled`

### 验收
- 审批通过后才能触发受控动作。
- 驳回会写入原因并回流到决策单。
- 审批节点具有顺序信息。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 recommendation / approval 模块。

---

## BE-P1-019 动作执行、幂等与回滚

```yaml
id: BE-P1-019
priority: P1
kind: backend
depends_on: [BE-P1-018]
scope:
  - server/internal/handler/action.go
  - server/internal/service/action/*
  - server/pkg/db/queries/action.sql
deliverables:
  - POST /api/decisions/{id}/execute
  - POST /api/actions/{id}/rollback
  - action_run 幂等控制
```

### 目标
任何外部写操作都必须可追踪、可重试、可回滚、可熔断。

### 验收
- 动作必须携带 `Idempotency-Key`。
- `action_run` 记录：
  - connector_id
  - action_type
  - request_payload
  - external_ref
  - rollback_payload
  - status
  - runtime_id
- 自动模式仅允许白名单动作。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 action 模块与相关 migration。

---

## BE-P1-020 连接器管理与 mock/sandbox 写入

```yaml
id: BE-P1-020
priority: P1
kind: backend
depends_on: [DB-P0-015]
scope:
  - server/internal/handler/connector.go
  - server/internal/service/connector/*
  - server/pkg/db/queries/connector.sql
deliverables:
  - GET/POST/PATCH /api/connectors
  - POST /api/connectors/{id}/test
  - mock connector adapter
```

### 目标
演示阶段先实现“读真实、写受控”，没有真实写接口时走 mock/sandbox。

### 验收
- Connector 支持 `ERP / OMS / WMS / DWH / BI` 类型。
- 支持 `read / write / webhook` capability。
- 可配置 `allowed_actions`。
- 测试连接结果可见。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 connector 模块。

---

## BE-P1-021 Runtime 扩展为通用执行器

```yaml
id: BE-P1-021
priority: P1
kind: backend
depends_on: [BE-P0-016]
scope:
  - server/migrations/045_runtime_executor_kind.up.sql
  - server/internal/handler/runtime.go
  - server/pkg/db/queries/runtime.sql
deliverables:
  - executor_kind 字段
  - runtime 元数据扩展
```

### 目标
把 runtime 从“本地 agent daemon”扩展为“通用执行环境”。

### 新字段
- `executor_kind`
- `network_zone`
- `credential_scope`
- `resource_quota`
- `allowed_actions`
- `approval_required`

### 验收
- Runtime 列表可区分：
  - `llm_agent`
  - `sql_runner`
  - `python_worker`
  - `optimizer`
  - `connector_action`
- 历史 local runtime 兼容不报错。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 runtime migration 与 query 变更。

---

## BE-P1-022 控制塔告警与指标快照 API

```yaml
id: BE-P1-022
priority: P1
kind: backend
depends_on: [DB-P0-015, BE-P0-016]
scope:
  - server/internal/handler/tower.go
  - server/internal/handler/metrics.go
  - server/internal/service/tower/*
  - server/internal/service/metrics/*
deliverables:
  - GET /api/tower/alerts
  - POST /api/tower/alerts/{id}/decision
  - GET /api/metrics/snapshots
```

### 目标
给工作台和决策详情提供结构化数据入口。

### 验收
- 告警支持分页、筛选、排序。
- 告警转决策单时会冻结快照。
- 指标快照支持来源引用与采集时间。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 tower / metrics 模块。

---

## GOV-P1-023 审计链与不可变执行轨迹

```yaml
id: GOV-P1-023
priority: P1
kind: backend
depends_on: [BE-P1-019]
scope:
  - server/migrations/046_audit_events.up.sql
  - server/internal/service/audit/*
  - server/internal/handler/activity.go
deliverables:
  - audit_event 表
  - 动作/审批/推荐/回滚审计记录
```

### 目标
建立真正可交付的企业审计最小闭环。

### 审计维度
- 谁做的：用户 / Agent / 执行环境
- 做了什么：诊断 / 推荐 / 审批 / 执行 / 回滚
- 基于什么：snapshot / skill_version / model_version / connector
- 结果如何：成功 / 失败 / 外部单号 / 错误 / 耗时

### 验收
- 所有写动作必须落审计。
- 失败也必须保留记录。
- 活动流中能看到业务可读摘要。

### 验证
```bash
cd server && go test ./...
```

### 回滚
回退 audit migration 与 service。

---

## QA-P1-024 前后端联调种子数据

```yaml
id: QA-P1-024
priority: P1
kind: qa
depends_on: [BE-P1-022, FE-P0-010]
scope:
  - server/seeds/*
  - apps/web/dev-fixtures/*
deliverables:
  - 4 个演示场景种子数据
  - workspace/project/decision/connector/runtime/skill 样例
```

### 目标
没有样例数据，所有页面只能看空壳，Demo 无法演示。

### 必备场景
- 爆品断货风险
- 区域库存失衡
- 供应商延迟交付
- 预测偏差过大

### 验收
- 一键导入后可直接看到完整列表、详情、仿真、审批链路。
- 告警可以转为决策单。
- 至少存在 4 个 Agent、3 类 Runtime、1 套 Connector。

### 验证
```bash
cd server && go test ./...
# 执行 seed 脚本后人工验收 UI
```

### 回滚
清理种子数据并回退 seed 文件。

---

## QA-P0-025 API 合约测试

```yaml
id: QA-P0-025
priority: P0
kind: qa
depends_on: [BE-P1-022]
scope:
  - server/tests/api/*
  - api_contract.md
deliverables:
  - 决策 / 仿真 / 审批 / 动作 / 连接器 API contract tests
```

### 目标
新接口多，必须用 contract tests 固定行为。

### 验收
- 成功场景、错误场景、权限场景、幂等场景都有覆盖。
- 返回码、字段名、枚举值稳定。
- contract 与 `api_contract.md` 一致。

### 验证
```bash
cd server && go test ./...
```

### 回滚
删除 contract tests，不建议跳过。

---

## QA-P0-026 前端 E2E 业务闭环测试

```yaml
id: QA-P0-026
priority: P0
kind: qa
depends_on: [QA-P1-024, FE-P0-009]
scope:
  - e2e/decision-flow.spec.ts
  - e2e/i18n.spec.ts
  - e2e/approval-execution.spec.ts
deliverables:
  - 核心业务闭环 E2E
```

### 目标
验证 Demo 最关键的端到端路径，而不是只测组件细节。

### 必测链路
1. 告警 → 决策单
2. 决策单 → 诊断 → 仿真 → 推荐
3. 审批模式 → 审批通过 → 动作执行
4. 中文默认 → 英文切换 → 状态保持

### 验收
- 所有 P0 页面有覆盖。
- 失败截图与 trace 可保留。
- E2E 跑完后能直接用于演示彩排。

### 验证
```bash
pnpm test
# 按仓库现有 Playwright 配置执行 e2e
```

### 回滚
回退新增 e2e 文件。

---

## DEP-P1-027 私有化部署与演示运行手册

```yaml
id: DEP-P1-027
priority: P1
kind: deployment
depends_on: [QA-P1-024]
scope:
  - deployment.md
  - docker-compose.override.yml
  - .env.example
deliverables:
  - 私有化部署手册
  - demo 环境变量模板
  - runtime 节点拓扑
```

### 目标
把当前自托管底座升级为可演示、可交付、可控写入的企业内网部署方案。

### 验收
- Web / API / PostgreSQL / Object Storage / Runtime / Connector 拓扑明确。
- secrets 管理、网络区、只读/受控写入策略明确。
- 有升级与回滚步骤。

### 验证
```bash
pnpm --filter @multica/web build
cd server && go build ./cmd/server
docker compose config
```

### 回滚
恢复 compose/env 模板即可。

---

## 执行顺序建议

### 第一批（必须先做）
- BASE-P0-001
- BASE-P0-002
- BASE-P0-003
- I18N-P0-004
- I18N-P0-005
- I18N-P0-006

### 第二批（形成可见产品）
- FE-P0-007
- FE-P0-008
- FE-P0-009
- FE-P0-010
- DB-P0-014
- DB-P0-015
- BE-P0-016

### 第三批（形成可演示闭环）
- BE-P1-017
- BE-P1-018
- BE-P1-019
- BE-P1-020
- BE-P1-021
- BE-P1-022
- GOV-P1-023

### 第四批（交付加固）
- FE-P1-011
- FE-P1-012
- FE-P1-013
- QA-P1-024
- QA-P0-025
- QA-P0-026
- DEP-P1-027

---

## 全局 Done Definition

只有同时满足以下条件，才算“本轮深改可交付”：

- 默认语言为 `zh-CN`
- 核心导航已切换为业务语义
- 至少一个告警可转为决策单
- 决策单具备八 Tab 详情
- 至少跑通一个“诊断 → 仿真 → 推荐 → 审批/执行”闭环
- 至少 4 个 Agent、3 类 Runtime、1 套 Connector 可演示
- 写动作具备审计、幂等、回滚定义
- `pnpm lint && pnpm test && pnpm typecheck && pnpm --filter @multica/web build && cd server && go test ./...` 全部通过
