# Multica 数据库改造设计（database.md）

## 1. 设计原则

### 1.1 不推翻现有协作骨架
当前数据库已经围绕协作控制面形成基础骨架。  
本期应采用 **sidecar 扩展**，而不是重做主模型。

### 1.2 控制面只存元数据
控制面数据库只存：

- 决策语义
- 快照摘要
- 仿真结果摘要
- 推荐方案
- 审批记录
- 动作执行记录
- 连接器配置引用
- 审计记录

不存：

- ERP / OMS / WMS / DWH 全量事实明细
- 大体量订单流水
- 全量库存明细
- 明文外部系统密钥

### 1.3 专题归属只保留一个真相
当前基座已经通过 `issue.project_id` 表达 issue 与 project 的归属关系。  
因此新增 `decision_case` **不再重复持有 `project_id`**，避免双写与数据漂移。

### 1.4 演示默认安全优先
根据本期 PRD，默认执行模式应是“建议模式”。因此新增业务表中的 `execution_mode` 默认值建议为：

- `suggestion`

而不是 `approval` 或 `automatic`。

---

## 2. 当前基线表总结

### 2.1 已确认的核心表
以下是与本期改造直接相关、且已在当前仓库迁移中确认存在的表：

| 表 | 作用 |
|---|---|
| `workspace` | 工作空间 / 业务空间基座 |
| `member` | 成员与角色 |
| `issue` | 协作主对象 |
| `comment` | 评论 / 协同 |
| `agent` | Agent 定义 |
| `agent_runtime` | 执行环境基座 |
| `skill` | 技能基座 |
| `inbox_item` | 消息 / 待办 |
| `project` | 项目 / 专题 |

### 2.2 其他现有持久化
仓库中还存在 pin 相关能力，但本文件不对其底层表名作强假设；后续若设计涉及 pin，统一称为 **pin 子系统**。

---

## 3. 本期新增 sidecar 表

| 表 | 作用 |
|---|---|
| `decision_case` | 绑定 `issue` 的业务决策语义 |
| `decision_context_snapshot` | 冻结关键指标与来源引用 |
| `scenario_run` | 场景仿真运行记录 |
| `scenario_option` | 仿真候选方案 |
| `decision_recommendation` | 推荐主方案与备选方案 |
| `decision_approval` | 审批链 |
| `connector` | 外部系统连接器 |
| `action_run` | 外部动作执行记录 |
| `audit_event` | 审计事件 |

---

## 4. 命名与枚举策略

### 4.1 命名规则
- 表名统一 snake_case
- 时间字段统一 `*_at`
- 状态字段统一 `*_status`
- 需要高频过滤的字段使用强类型列
- 仅把弹性负载放入 JSONB

### 4.2 推荐枚举

#### `decision_case.phase`
- `identified`
- `diagnosing`
- `simulating`
- `recommending`
- `awaiting_approval`
- `approved`
- `executing`
- `monitoring`
- `closed`

#### `decision_case.risk_level`
- `low`
- `medium`
- `high`
- `critical`

#### `decision_case.execution_mode`
- `suggestion`
- `approval`
- `automatic`

#### `decision_case.approval_status`
- `draft`
- `pending`
- `approved`
- `rejected`
- `cancelled`

#### `decision_case.execution_status`
- `pending`
- `queued`
- `running`
- `succeeded`
- `failed`
- `rolled_back`

---

## 5. 核心表设计

## 5.1 decision_case

### 作用
为 `issue` 增加供应链业务语义。  
专题归属继续通过 `issue.project_id` 表达，不在本表重复存储。

### 建议 DDL
```sql
CREATE TABLE decision_case (
  issue_id UUID PRIMARY KEY REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  decision_type TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT NOT NULL,
  objective JSONB NOT NULL DEFAULT '{}'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  execution_mode TEXT NOT NULL DEFAULT 'suggestion',
  phase TEXT NOT NULL DEFAULT 'identified',
  approval_status TEXT NOT NULL DEFAULT 'draft',
  execution_status TEXT NOT NULL DEFAULT 'pending',
  owner_role_hint TEXT NULL,
  due_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (risk_level IN ('low','medium','high','critical')),
  CHECK (execution_mode IN ('suggestion','approval','automatic')),
  CHECK (phase IN ('identified','diagnosing','simulating','recommending','awaiting_approval','approved','executing','monitoring','closed')),
  CHECK (approval_status IN ('draft','pending','approved','rejected','cancelled')),
  CHECK (execution_status IN ('pending','queued','running','succeeded','failed','rolled_back'))
);

CREATE INDEX idx_decision_case_workspace_phase ON decision_case (workspace_id, phase);
CREATE INDEX idx_decision_case_workspace_risk ON decision_case (workspace_id, risk_level);
CREATE INDEX idx_decision_case_workspace_mode ON decision_case (workspace_id, execution_mode);
CREATE INDEX idx_decision_case_object ON decision_case (object_type, object_id);
```

### 读取关系
专题信息通过如下方式得到：

```sql
SELECT i.id, i.project_id, p.name
FROM issue i
LEFT JOIN project p ON p.id = i.project_id
WHERE i.id = $1;
```

---

## 5.2 decision_context_snapshot

### 作用
冻结决策发生当时的关键指标与来源引用，用于审计与复盘。

### 建议 DDL
```sql
CREATE TABLE decision_context_snapshot (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  snapshot_version INT NOT NULL,
  metric_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_hash TEXT NULL,
  captured_by_type TEXT NOT NULL DEFAULT 'system',
  captured_by_id UUID NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(issue_id, snapshot_version)
);

CREATE INDEX idx_decision_snapshot_issue ON decision_context_snapshot (issue_id, captured_at DESC);
CREATE INDEX idx_decision_snapshot_workspace ON decision_context_snapshot (workspace_id, captured_at DESC);
```

### `metric_summary` 示例
```json
{
  "inventory_qty": 1200,
  "coverage_days": 2.1,
  "forecast_7d": 3500,
  "service_level": 0.91,
  "supplier_otd": 0.84
}
```

---

## 5.3 scenario_run

### 作用
记录一次仿真运行。

### 建议 DDL
```sql
CREATE TABLE scenario_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  snapshot_id UUID NOT NULL REFERENCES decision_context_snapshot(id) ON DELETE RESTRICT,
  runtime_id UUID NULL REFERENCES agent_runtime(id) ON DELETE SET NULL,
  solver_version TEXT NULL,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('queued','running','succeeded','failed','cancelled'))
);

CREATE INDEX idx_scenario_run_issue ON scenario_run (issue_id, created_at DESC);
CREATE INDEX idx_scenario_run_status ON scenario_run (workspace_id, status, created_at DESC);
```

---

## 5.4 scenario_option

### 作用
记录一次仿真中的候选方案。

### 建议 DDL
```sql
CREATE TABLE scenario_option (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_run_id UUID NOT NULL REFERENCES scenario_run(id) ON DELETE CASCADE,
  option_code TEXT NOT NULL,
  rank_no INT NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL,
  score NUMERIC(8,4) NULL,
  cost NUMERIC(18,2) NULL,
  lead_time_hours NUMERIC(18,2) NULL,
  stockout_rate NUMERIC(8,4) NULL,
  service_level NUMERIC(8,4) NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  impact_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scenario_option_run ON scenario_option (scenario_run_id, rank_no);
```

---

## 5.5 decision_recommendation

### 作用
记录系统生成的主方案与备选方案。

### 建议 DDL
```sql
CREATE TABLE decision_recommendation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  scenario_run_id UUID NULL REFERENCES scenario_run(id) ON DELETE SET NULL,
  snapshot_id UUID NULL REFERENCES decision_context_snapshot(id) ON DELETE SET NULL,
  primary_option_id UUID NULL REFERENCES scenario_option(id) ON DELETE SET NULL,
  alternative_option_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence NUMERIC(8,4) NULL,
  rationale_md TEXT NOT NULL DEFAULT '',
  expected_impact JSONB NOT NULL DEFAULT '{}'::jsonb,
  guardrails JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_type TEXT NOT NULL DEFAULT 'system',
  created_by_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendation_issue ON decision_recommendation (issue_id, created_at DESC);
```

---

## 5.6 decision_approval

### 作用
记录审批链。

### 建议 DDL
```sql
CREATE TABLE decision_approval (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  recommendation_id UUID NULL REFERENCES decision_recommendation(id) ON DELETE SET NULL,
  sequence_no INT NOT NULL DEFAULT 1,
  approver_type TEXT NOT NULL,
  approver_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  comment TEXT NULL,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('draft','pending','approved','rejected','cancelled'))
);

CREATE INDEX idx_approval_issue ON decision_approval (issue_id, sequence_no);
CREATE INDEX idx_approval_pending ON decision_approval (workspace_id, status, created_at DESC);
```

---

## 5.7 connector

### 作用
管理外部系统连接器。

### 关键约束
- `config` 只保存非敏感配置与元数据
- 密钥、令牌、口令等敏感信息不落库
- 敏感信息通过 `secret_ref` 引用客户密钥管理系统

### 建议 DDL
```sql
CREATE TABLE connector (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connector_type TEXT NOT NULL,
  auth_type TEXT NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'healthy',
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  secret_ref TEXT NULL,
  healthcheck JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_sync_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_connector_workspace_type ON connector (workspace_id, connector_type);
CREATE INDEX idx_connector_workspace_status ON connector (workspace_id, status);
```

### `config` 示例
```json
{
  "endpoint": "https://erp-sandbox.internal",
  "region": "cn-east-1",
  "timeout_ms": 10000,
  "default_company_code": "1000"
}
```

---

## 5.8 action_run

### 作用
记录外部动作执行与回滚信息。

### 建议 DDL
```sql
CREATE TABLE action_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issue(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  approval_id UUID NULL REFERENCES decision_approval(id) ON DELETE SET NULL,
  connector_id UUID NOT NULL REFERENCES connector(id) ON DELETE RESTRICT,
  runtime_id UUID NULL REFERENCES agent_runtime(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  action_target JSONB NOT NULL DEFAULT '{}'::jsonb,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  rollback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT NOT NULL,
  external_ref TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT NULL,
  executed_by_type TEXT NOT NULL DEFAULT 'system',
  executed_by_id UUID NULL,
  started_at TIMESTAMPTZ NULL,
  finished_at TIMESTAMPTZ NULL,
  rolled_back_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status IN ('pending','queued','running','succeeded','failed','rolled_back'))
);

CREATE UNIQUE INDEX uq_action_run_idempotency ON action_run (workspace_id, idempotency_key);
CREATE INDEX idx_action_run_issue ON action_run (issue_id, created_at DESC);
CREATE INDEX idx_action_run_status ON action_run (workspace_id, status, created_at DESC);
```

---

## 5.9 audit_event

### 作用
记录关键业务动作的审计事件。

### 建议 DDL
```sql
CREATE TABLE audit_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id UUID NULL,
  runtime_id UUID NULL REFERENCES agent_runtime(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  prev_hash TEXT NULL,
  current_hash TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_event (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_workspace ON audit_event (workspace_id, created_at DESC);
```

---

## 6. 关系与读取策略

## 6.1 关系总览

| 主体 | 关系 |
|---|---|
| `workspace` | 1:N `project` / `issue` / `agent` / `runtime` / `skill` / `connector` |
| `project` | 1:N `issue` |
| `issue` | 1:1 `decision_case` |
| `issue` | 1:N `comment` / `decision_context_snapshot` / `scenario_run` / `decision_recommendation` / `decision_approval` / `action_run` |
| `scenario_run` | 1:N `scenario_option` |
| `connector` | 1:N `action_run` |

## 6.2 决策详情聚合
决策详情应通过如下聚合关系读取：

- `issue`
- `decision_case`
- `issue.project_id -> project`
- `latest snapshot`
- `latest scenario_run`
- `latest recommendation`
- `latest approval`
- `action_run list`
- `comment/activity`

---

## 7. 迁移顺序建议

### M1：能力基线
1. `decision_case`
2. `decision_context_snapshot`
3. `scenario_run`
4. `scenario_option`

### M2：执行闭环
5. `decision_recommendation`
6. `decision_approval`
7. `connector`
8. `action_run`

### M3：治理增强
9. `audit_event`

---

## 8. 数据回填与兼容

### 8.1 旧 issue 的兼容
旧 `issue` 不强制回填成 `decision_case`。  
只有进入供应链业务流的 issue 才创建 sidecar 行。

### 8.2 project 归属
如果某个旧 issue 已有 `issue.project_id`，则新决策详情直接沿用，无需再同步一份到 `decision_case`。

### 8.3 execution_mode 默认值
如果 API 未显式传入 `execution_mode`，数据库默认应回落到 `suggestion`。  
只有通过业务规则或人工选择，才切换为 `approval` / `automatic`。

---

## 9. 风险与边界

### 9.1 不要把事实数据搬进控制面
库存、订单、预测明细等只通过引用和快照摘要接入。

### 9.2 不要把 secret 放进 JSONB
`config` 只能放非敏感配置。密钥统一走 `secret_ref`。

### 9.3 不要在多个表重复存专题归属
专题归属统一以 `issue.project_id` 为准。

---

## 10. 验证建议

### 10.1 迁移验证
```bash
cd server && go test ./...
cd server && go build ./cmd/server
```

### 10.2 数据库核查清单
- `decision_case.execution_mode` 默认值为 `suggestion`
- `decision_case` 不再持有 `project_id`
- `connector` 包含 `secret_ref`
- `action_run` 的 `idempotency_key` 具备唯一索引
- 聚合查询能够通过 `issue.project_id` 正确取到专题

### 10.3 完成定义
数据库设计完成至少满足：

1. 不破坏现有协作主模型
2. 决策闭环对象完整
3. 不重复建模专题归属
4. 默认执行模式安全
5. 连接器敏感信息不落库
6. 支持审计、幂等、回滚
