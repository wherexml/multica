# Multica 前端改造说明（frontend.md）

## 1. 前端基线

### 1.1 当前结构
当前仓库 Web 端的实际结构已经比较清晰：

- 路由主入口：`apps/web/app/(dashboard)`
- 页面壳：`DashboardLayout`
- 页面实现主体：`packages/views/*`
- 共享 UI：`packages/ui/*`
- 全局样式与令牌：`packages/ui/styles/tokens.css`、`base.css`

### 1.2 当前可直接复用的页面壳

| 页面 | 当前能力 | 后续定位 |
|---|---|---|
| `InboxPage` | 主从布局、未读/归档、可调宽度 | 工作台 / 待办与告警 |
| `IssuesPage` | 列表/看板切换、筛选、批量操作 | 决策单中心 |
| `IssueDetail` | 标题、描述、状态、优先级、Assignee、Due date、子任务、Activity、Pin | 决策单详情 |
| `Projects` / `ProjectDetail` | 项目详情 + 关联 issues | 专题中心 |
| `Agents` | 资源列表与详情壳 | 专家 Agent |
| `Runtimes` | 资源列表与详情壳 | 执行环境 |
| `Skills` | 资源列表与详情壳 | 技能包 |
| `SettingsPage` | 纵向 tabs 配置结构 | 平台设置 |

### 1.3 当前前端约束
必须正视当前仓库已经存在的 UI 现实：

1. 顶层壳不是空白页，而是 `DashboardLayout`
2. `SearchTrigger` / `SearchCommand` 已内置
3. `ChatWindow` / `ChatFab` 已内置
4. `AppSidebar` 已形成稳定分组结构
5. `IssueDetail` 已经很重，不适合继续粗暴堆逻辑
6. 根布局当前仍默认 `lang="en"`
7. `LocaleSync` 已存在，但尚未形成完整 i18n 体系

---

## 2. 前端改造总策略

### 2.1 先保壳，再换义
本期前端不做“推倒重写”，而做：

- 保留页面路由
- 保留页面壳层
- 保留成熟交互
- 切换业务语义
- 增加供应链字段与业务分区

### 2.2 先组件拆分，再业务加层
特别是 `IssueDetail`，必须遵循：

- 先拆分成多个子区块 / Tab
- 再增加快照、仿真、审批、动作执行等业务内容
- 禁止继续把所有逻辑堆回单个大文件

### 2.3 先词典化，再中文化
所有对外业务文案必须：

- 进入 i18n 消息包
- 经由词典层输出
- 不再直接在页面组件中硬编码中文或英文业务标签

---

## 3. 路由映射策略

| 现有路径 | 目标语义 | 处理方式 |
|---|---|---|
| `/inbox` | 工作台 / 待办与告警 | 保留路径，替换内容 |
| `/my-issues` | 我的待办 | 保留路径，中文化与业务语义增强 |
| `/issues` | 决策单中心 | 保留路径，增强字段与筛选 |
| `/issues/[id]` | 决策单详情 | 保留路径，升级详情结构 |
| `/projects` | 专题中心 | 保留路径，替换文案 |
| `/projects/[id]` | 专题详情 | 保留路径，增强摘要与指标 |
| `/agents` | 专家 Agent | 保留路径，增强业务元信息 |
| `/runtimes` | 执行环境 | 保留路径，增强执行器字段 |
| `/skills` | 技能包 | 保留路径，增加版本/评测信息 |
| `/settings` | 平台设置 | 保留路径，增加配置项 |
| `/tower` | 控制塔 / 业务透镜 | 视需要新增 |
| `/approvals` | 审批中心 | 视需要新增 |
| `/connectors` | 连接器中心 | 视需要新增，或挂设置页 |

**原则**  
新增一级路由必须证明现有页面无法承载。

---

## 4. 文件级改造地图

## 4.1 必改文件

### 壳层与语言
- `apps/web/app/layout.tsx`
- `apps/web/components/locale-sync.tsx`
- `apps/web/app/(dashboard)/layout.tsx`
- `packages/views/layout/app-sidebar.tsx`

### 页面主体
- `packages/views/inbox/components/inbox-page.tsx`
- `packages/views/issues/components/issues-page.tsx`
- `packages/views/issues/components/issues-header.tsx`
- `packages/views/issues/components/issue-detail.tsx`
- `packages/views/projects/components/project-detail.tsx`
- `packages/views/settings/components/settings-page.tsx`

### 消息包与词典
- `apps/web/messages/zh-CN/*.json`
- `apps/web/messages/en-US/*.json`
- `packages/core/platform/lexicon.ts`
- `packages/core/platform/i18n/*`

## 4.2 建议新增目录

```text
packages/core/decisions/
  queries.ts
  mutations.ts
  types.ts
  selectors.ts

packages/views/decisions/components/
  decision-summary-strip.tsx
  decision-overview-tab.tsx
  decision-snapshot-tab.tsx
  decision-diagnosis-tab.tsx
  decision-scenarios-tab.tsx
  decision-recommendation-tab.tsx
  decision-approval-tab.tsx
  decision-actions-tab.tsx
  decision-activity-tab.tsx

packages/views/tower/components/
  tower-page.tsx
  tower-alert-list.tsx
  tower-alert-detail.tsx
  tower-filters.tsx

packages/views/connectors/components/
  connectors-page.tsx
  connector-detail.tsx

packages/views/approvals/components/
  approvals-page.tsx
  approval-detail.tsx
```

---

## 5. i18n 与语言方案

## 5.1 现状与问题
当前仓库不是完全没有 locale，而是“有 scaffold、无完整体系”：

- 根布局默认 `lang="en"`
- `LocaleSync` 负责根据 cookie 更新 `<html lang>`
- 当前逻辑更偏 `zh` 单值处理
- 侧边导航、设置页等仍有大量英文硬编码

## 5.2 实施要求
后续 i18n 改造必须满足：

1. 默认语言 `zh-CN`
2. 支持 `en-US`
3. 兼容已有 `multica-locale`
4. 兼容旧值：
   - `zh` → 规范化为 `zh-CN`
   - `en` → 规范化为 `en-US`
5. 保留当前“不在 root Server Component 里强依赖 `cookies()`”的实现思路
6. 所有页面文案进入消息包

## 5.3 语言优先级
建议语言解析顺序：

1. 用户个人设置
2. 工作空间默认语言
3. `multica-locale` cookie
4. 默认值 `zh-CN`

## 5.4 侧边导航改造
当前 `app-sidebar.tsx` 的问题不是布局，而是 label 硬编码。  
改造方式是：

- 保留导航数组结构
- 将 `label` 改为 `labelKey`
- 所有组标题与项目名从消息包取值

示例：

```ts
const personalNav = [
  { href: "/inbox", labelKey: "nav.workbench", icon: Inbox },
  { href: "/my-issues", labelKey: "nav.myTasks", icon: CircleUserRound },
]
```

---

## 6. 页面级改造说明

## 6.1 工作台（Inbox → 工作台 / 待办与告警）

### 保留
- `ResizablePanelGroup`
- 左列表 / 右详情
- 未读/归档能力
- 空状态与列表交互节奏

### 增加
左侧列表项增加：

- 告警类型
- 风险等级
- 业务对象
- 指标变化摘要
- 待审批标记
- 决策单关联状态

右侧详情增加：

- 触发原因
- 快照摘要
- 推荐动作
- 一键生成决策单
- 关联执行轨迹

### 禁止
- 改成营销看板式九宫格首屏
- 改成纯聊天首页
- 丢掉主从结构

## 6.2 决策单中心（Issues → 决策单中心）

### 保留
- `IssuesHeader`
- `BoardView`
- `ListView`
- `BatchActionToolbar`

### 增加
`IssuesHeader` 中补充供应链筛选项：

- phase
- risk_level
- execution_mode
- decision_type
- warehouse / region / sku
- project_id

### 视图策略
- Board：用于阶段流转与管理节奏
- List：用于高密度筛选与批量操作

### 注意
不要重写一套新的列表框架；优先扩展现有 header、列定义、卡片内容。

## 6.3 决策单详情（IssueDetail → 业务化详情）

### 保留
- `TitleEditor`
- `ContentEditor`
- 元信息操作
- Pin / Copy Link / Due date
- Activity
- Sub-issues

### 新结构建议
将业务内容从 `IssueDetail` 中拆成独立子组件，以 Tab 或显式分区接入：

```text
IssueDetailShell
  ├─ Header
  ├─ DecisionSummaryStrip
  ├─ Tabs
  │   ├─ Overview
  │   ├─ Snapshot
  │   ├─ Diagnosis
  │   ├─ Scenarios
  │   ├─ Recommendation
  │   ├─ Approval
  │   ├─ Actions
  │   └─ Activity
  └─ Sub-issues
```

### 拆分建议
优先拆出：

- `decision-summary-strip.tsx`
- `decision-overview-tab.tsx`
- `decision-snapshot-tab.tsx`
- `decision-scenarios-tab.tsx`
- `decision-approval-tab.tsx`

### 数据策略
首屏优先使用聚合接口 `/api/decisions/{id}`，避免 8 个 Tab 首屏各自打散请求。

## 6.4 专题中心（Projects）

### 保留
- 当前 `ProjectDetail` 对 issues 的承载方式
- 当前列表 / 看板切换结构

### 增加
顶部摘要区增加：

- 专题目标
- 关键指标
- 风险摘要
- 决策阶段分布
- 最近执行结果

### 注意
专题中心不是 BI 大屏，而是“一个专题下的决策流”。

## 6.5 专家 Agent / 执行环境 / 技能包

### Agent 页面
在现有资源卡/列表上增加：

- 业务域
- 能力域
- 绑定技能包
- 最近成功率
- 可用执行环境
- 数据依赖要求

### Runtime 页面
在现有页面上增加：

- `executor_kind`
- 网络区域
- 凭证作用域
- 资源配额
- 动作白名单
- 审批要求

### Skill 页面
增加：

- 版本号
- I/O schema
- 依赖 runtime
- 依赖 connector
- 评测结果
- 回滚说明

## 6.6 平台设置（Settings）

### 保留
- 纵向 Tabs 架构

### 增加
推荐新增的 Tab / 分组：

- 语言
- 连接器
- 审批规则
- 审计
- 模型评测
- 工作空间默认配置

### 注意
设置页扩展优先，不要把配置能力拆到多个零散页面。

---

## 7. 组件与样式约束

## 7.1 基础原则
所有新增业务组件优先基于 `packages/ui` 现有组件实现。

优先级：

1. 直接复用
2. 轻量包装
3. 新增业务组件
4. 最后才新增基础组件

## 7.2 样式原则
- 使用设计令牌，不直接硬编码颜色
- 保持 light / dark 双主题可读性
- 保持与现有页面一致的间距节奏
- 表格、状态标签、操作按钮风格保持统一

## 7.3 状态标签规范
列表中应至少区分：

- 协作状态
- 决策阶段
- 风险等级
- 审批状态
- 执行状态

不要把不同状态塞成一个 Badge。

---

## 8. 状态管理与数据获取

## 8.1 查询组织
建议新增 `packages/core/decisions`，收口：

- query keys
- 资源类型
- DTO
- 聚合 response mapper
- mutations

## 8.2 首屏请求策略
- 列表页：继续资源型查询
- 详情页：优先聚合查询
- Tab 内容：首屏所需字段由聚合接口返回；深层内容再按需懒加载

## 8.3 乐观更新边界
适合乐观更新的操作：

- pin / unpin
- 标记已读
- 列表筛选展示偏好
- 低风险标签切换

不适合乐观更新的操作：

- 审批通过/驳回
- 外部系统执行
- 回滚
- 快照生成
- 场景仿真完成状态

---

## 9. 测试与验收建议

## 9.1 前端必跑
```bash
pnpm lint
pnpm test
pnpm typecheck
pnpm --filter @multica/web build
```

## 9.2 关键回归点
- 侧边栏导航是否仍可用
- 搜索与聊天入口是否未被破坏
- `/inbox` 主从布局是否正常
- `/issues` 看板/列表切换是否正常
- `/issues/[id]` 标题/描述/子任务/Activity 是否正常
- `/projects` 与 `/projects/[id]` 是否正常
- `/settings` tab 切换是否正常
- 深色模式是否可用
- 中文默认语言是否生效

## 9.3 完成定义
前端改造完成至少满足：

1. 仍然基于当前页面壳运行
2. 中文默认可用
3. 决策单中心与详情已业务化
4. 工作台、专题中心、Agent/Runtime/Skill 页面语义完成替换
5. 设置页能够承载语言、连接器、审批、审计配置
6. 不破坏现有搜索、聊天、Pin、批量操作、看板/列表能力
