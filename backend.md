# Multica 后端改造说明（backend.md）

## 1. 后端基线

### 1.1 当前结构
当前后端仍是典型的 Go 单体服务骨架：

- 路由入口：`server/cmd/server/router.go`
- Handler：`server/internal/handler/*`
- Service：`server/internal/service/*`
- SQL / 查询层：`server/pkg/db/queries/*`
- Migration：`server/migrations/*`

### 1.2 当前资源重心
现有 API 已覆盖的核心资源以协作控制面为主：

- auth
- workspaces
- issues
- agents
- skills
- runtimes
- inbox
- tokens

### 1.3 当前关键缺口
最重要的基线问题是：

- `server/internal/handler/project.go` 已存在项目相关 handler
- 但 `server/cmd/server/router.go` 当前未挂出 `/api/projects`

这意味着“专题中心”虽然数据库与 handler 存在，但 API 暴露不完整，必须优先修复。

---

## 2. 改造目标

在不推翻现有控制面骨架的前提下，补齐供应链决策闭环所需后端能力：

1. 决策单语义层
2. 决策上下文快照
3. 场景仿真
4. 推荐方案
5. 审批流
6. 动作执行
7. 连接器
8. 控制塔告警
9. 审计与幂等
10. Runtime 执行器扩展

---

## 3. 总体架构策略

## 3.1 sidecar 扩展，不重写 issue
核心原则：

- `issue` 继续作为协作主对象
- `issue.project_id` 继续作为专题归属主来源
- `decision_case` 只补业务语义，不再重复持有 `project_id`
- 其余能力通过新增表、聚合 API、服务层扩展叠加

这样可以避免：

- 双写 `project_id`
- 前端和后端对专题归属出现双真相
- 大面积改动现有 issue 读写链路

## 3.2 聚合读，分层写

### 聚合读
复杂详情页统一走聚合接口：

- `GET /api/decisions`
- `GET /api/decisions/{id}`

### 分层写
业务动作拆分为独立接口：

- 诊断
- 仿真
- 推荐
- 提交审批
- 审批
- 执行
- 回滚

## 3.3 读真实，写受控
- 读取优先接 DWH / ERP / OMS / WMS / BI
- 写入优先 mock / sandbox / 建议单
- 正式写接口仅在审批模式或自动白名单下开放

---

## 4. 目标目录结构

```text
server/internal/handler/
  decision.go
  scenario.go
  recommendation.go
  approval.go
  action.go
  connector.go
  tower.go
  metrics.go

server/internal/service/
  decision/
    service.go
    model.go
    mapper.go
  scenario/
    service.go
    executor.go
  recommendation/
    service.go
  approval/
    service.go
    state_machine.go
  action/
    service.go
    dispatcher.go
    idempotency.go
  connector/
    service.go
    registry.go
    adapters/
      erp.go
      oms.go
      wms.go
      dwh.go
  tower/
    service.go
  audit/
    service.go

server/pkg/db/queries/
  decision.sql
  scenario.sql
  approval.sql
  action.sql
  connector.sql
  tower.sql
```

---

## 5. 路由与资源设计

## 5.1 先修复现有项目路由
优先在 `router.go` 挂出：

```go
r.Route("/api/projects", func(r chi.Router) {
    r.Get("/", h.ListProjects)
    r.Post("/", h.CreateProject)
    r.Get("/{projectID}", h.GetProject)
    r.Put("/{projectID}", h.UpdateProject)
    r.Delete("/{projectID}", h.DeleteProject)
})
```

## 5.2 新增供应链语义层路由
建议新增：

```go
r.Route("/api/decisions", func(r chi.Router) {
    r.Get("/", h.ListDecisions)
    r.Post("/", h.CreateDecision)
    r.Get("/{decisionID}", h.GetDecision)
    r.Patch("/{decisionID}", h.UpdateDecision)
    r.Post("/{decisionID}/diagnose", h.StartDiagnosis)
    r.Post("/{decisionID}/scenarios/run", h.RunScenario)
    r.Post("/{decisionID}/recommend", h.GenerateRecommendation)
    r.Post("/{decisionID}/submit-approval", h.SubmitApproval)
    r.Post("/{decisionID}/execute", h.ExecuteDecision)
    r.Post("/{decisionID}/rollback", h.RollbackDecisionAction)
})

r.Route("/api/connectors", func(r chi.Router) {
    r.Get("/", h.ListConnectors)
    r.Post("/", h.CreateConnector)
    r.Get("/{connectorID}", h.GetConnector)
    r.Patch("/{connectorID}", h.UpdateConnector)
    r.Post("/{connectorID}/test", h.TestConnector)
})

r.Route("/api/tower", func(r chi.Router) {
    r.Get("/alerts", h.ListTowerAlerts)
    r.Post("/alerts/{alertID}/decision", h.CreateDecisionFromAlert)
})

r.Route("/api/metrics", func(r chi.Router) {
    r.Get("/snapshots", h.ListMetricSnapshots)
})
```

---

## 6. 分层职责

## 6.1 Handler 层
职责：

- 参数解析
- workspace / auth 校验
- 调用 service
- 响应映射
- 错误码统一

禁止：

- 在 handler 中拼业务状态机
- 在 handler 中直接调用 connector adapter
- 在 handler 中直接写复杂 SQL 逻辑

## 6.2 Service 层
职责：

- 状态机
- 聚合查询编排
- 审批与执行规则
- 幂等控制
- connector / runtime 调度

## 6.3 Query / Repository 层
职责：

- SQL 查询
- 分页
- 过滤
- 聚合 join
- 版本化迁移后的读写兼容

---

## 7. 决策单聚合模型

## 7.1 为什么不能只用 issue
`issue` 足够承载协作元信息，但不够表达供应链决策：

- 决策类型
- 业务对象
- 风险等级
- 执行模式
- 业务阶段
- 快照
- 推荐方案
- 审批流
- 动作执行

因此需要以 `issue + decision_case + snapshot + scenario + recommendation + approval + action` 聚合返回。

## 7.2 聚合响应结构
建议 `GET /api/decisions/{id}` 返回：

```json
{
  "issue": {},
  "decision": {},
  "project": {},
  "latest_snapshot": {},
  "latest_scenario_run": {},
  "latest_recommendation": {},
  "latest_approval": {},
  "actions": [],
  "activity": []
}
```

其中：

- 专题归属通过 `issue.project_id` 关联
- 不在 `decision_case` 再存一份 `project_id`

---

## 8. 状态机设计

## 8.1 决策阶段
```text
identified
  -> diagnosing
  -> simulating
  -> recommending
  -> awaiting_approval
  -> approved
  -> executing
  -> monitoring
  -> closed
```

### 迁移约束
- 没有 snapshot，不允许进入 `simulating`
- 没有 recommendation，不允许提交审批
- 审批未通过，不得执行受控写动作
- 执行失败后允许回到 `recommending` 或 `awaiting_approval`
- 状态变更都写入 activity 和 audit_event

## 8.2 审批状态
```text
draft -> pending -> approved / rejected / cancelled
```

## 8.3 执行状态
```text
pending -> queued -> running -> succeeded / failed / rolled_back
```

---

## 9. Runtime 执行器扩展

### 9.1 新语义
当前 runtime 偏“本地 agent daemon”，本期应扩展为通用执行环境：

- `llm_agent`
- `sql_runner`
- `python_worker`
- `optimizer`
- `connector_action`

### 9.2 建议字段
可先放 metadata，后续再迁为强类型列：

- `executor_kind`
- `network_zone`
- `credential_scope`
- `resource_quota`
- `allowed_actions`
- `approval_required`

### 9.3 兼容策略
旧 runtime 不强制一次性改表；先通过 metadata 承载，待稳定后再落迁移。

---

## 10. 连接器设计

### 10.1 定位
连接器不是简单的“连接配置”，而是受治理的数据与动作入口。

### 10.2 核心能力
- 测试连接
- 声明读写能力
- 限制 allowed_actions
- 暴露健康状态
- 使用 `secret_ref` 引用密钥管理系统
- 禁止明文凭证落库

### 10.3 Adapter 分层
```text
connector/service.go
connector/registry.go
connector/adapters/*.go
```

### 10.4 Demo 优先顺序
优先实现：

1. DWH 读取
2. OMS mock 读取
3. WMS mock 读取/建议写入
4. ERP sandbox 写入

---

## 11. 动作执行设计

### 11.1 核心要求
任何外部写动作必须具备：

1. 明确 `action_type`
2. 明确 connector
3. `Idempotency-Key`
4. 可追踪外部单号
5. 明确失败状态
6. 明确回滚定义
7. 审批与白名单校验

### 11.2 Dispatcher 流程
```text
validate mode / approval / connector permissions
  -> create action_run
  -> dispatch connector adapter
  -> persist external_ref / result
  -> emit audit_event
```

### 11.3 回滚规则
不是所有动作都能回滚。  
必须为每种动作声明：

- 是否可回滚
- 回滚条件
- 回滚 payload
- 回滚时间窗

---

## 12. 审计与幂等

## 12.1 审计对象
- 诊断
- 仿真
- 推荐
- 审批
- 执行
- 回滚
- 连接器变更
- Runtime 关键配置变更

## 12.2 审计字段
- actor_type
- actor_id
- runtime_id
- entity_type
- entity_id
- action
- payload
- result
- created_at

## 12.3 幂等
所有执行接口必须接受 `Idempotency-Key`。  
冲突时返回：

- `IDEMPOTENCY_CONFLICT`

---

## 13. 向后兼容

必须兼容：

- 现有 issue / project / agent / runtime / skill API
- 现有 workspace 机制
- 现有 activity 流

允许渐进迁移：

- 详情页逐步从 issue API 转向 decision 聚合 API
- runtime 新字段先 metadata 化
- skill 版本化先外挂表

---

## 14. 验证建议

## 14.1 必跑命令
```bash
cd server && go test ./...
cd server && go build ./cmd/server
```

## 14.2 回归清单
- `/api/projects`
- `/api/issues`
- `/api/decisions`
- `/api/connectors`
- `/api/tower/alerts`
- `/api/runtimes`
- `/api/skills`

## 14.3 完成定义
以下全部成立才算后端阶段完成：

1. `/api/projects` 基线修复
2. 决策单聚合 API 可用
3. 仿真、推荐、审批、执行、回滚 API 可用
4. Connector 管理可用
5. Runtime 执行器扩展可用
6. 写动作具备幂等、审计、回滚定义
7. `go test ./...` 与 `go build ./cmd/server` 通过
