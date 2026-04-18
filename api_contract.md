# Multica 供应链 Demo API 合约（api_contract.md）

## 合约目标

本文件定义新增供应链语义层接口。旧接口继续兼容；新前端优先接入新聚合接口。

---

## 通用约定

## Header

| Header | 必填 | 说明 |
|---|---|---|
| `Authorization: Bearer <TOKEN>` | 是 | 登录态 |
| `X-Workspace-ID` | 是 | 业务空间隔离 |
| `Content-Type: application/json` | 写接口必填 | JSON 请求 |
| `Idempotency-Key` | 动作执行必填 | 防重放、防重复执行 |

## 统一响应包络

### 成功
```json
{
  "data": {},
  "meta": {
    "request_id": "req_xxx"
  },
  "error": null
}
```

### 失败
```json
{
  "data": null,
  "meta": {
    "request_id": "req_xxx"
  },
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "decision_type is required",
    "details": {}
  }
}
```

## 枚举

### decision phase
- `identified`
- `diagnosing`
- `simulating`
- `recommending`
- `awaiting_approval`
- `approved`
- `executing`
- `monitoring`
- `closed`

### risk level
- `low`
- `medium`
- `high`
- `critical`

### execution mode
- `suggestion`
- `approval`
- `automatic`

### approval status
- `draft`
- `pending`
- `approved`
- `rejected`
- `cancelled`

### execution status
- `pending`
- `queued`
- `running`
- `succeeded`
- `failed`
- `rolled_back`

---

## 资源模型

## DecisionCaseSummary
```json
{
  "id": "issue_uuid",
  "identifier": "DEC-1024",
  "title": "华东仓 SKU123 断货风险处理",
  "project_id": "project_uuid",
  "project_name": "爆品保供",
  "decision_type": "replenishment",
  "domain": "supply_chain",
  "object_type": "sku_warehouse",
  "object_id": "SKU123#WH_EAST",
  "phase": "simulating",
  "risk_level": "high",
  "execution_mode": "suggestion",
  "approval_status": "pending",
  "execution_status": "pending",
  "assignee_id": "member_uuid",
  "updated_at": "2026-04-12T10:00:00Z"
}
```

## DecisionCaseDetail
```json
{
  "issue": {},
  "decision": {},
  "latest_snapshot": {},
  "latest_scenario_run": {},
  "latest_recommendation": {},
  "latest_approval": {},
  "actions": [],
  "activity": []
}
```

## TowerAlert
```json
{
  "id": "alert_uuid",
  "alert_type": "stockout_risk",
  "severity": "high",
  "title": "华东仓 SKU123 7 日内可能断货",
  "object_type": "sku_warehouse",
  "object_id": "SKU123#WH_EAST",
  "summary": "近 48 小时订单增长 135%，在途不足",
  "metric_delta": {
    "demand_growth_rate": 1.35,
    "coverage_days": 2.1
  },
  "source_refs": [
    {"type": "oms", "ref": "order_spike_20260412"},
    {"type": "wms", "ref": "stock_snapshot_20260412"}
  ],
  "created_at": "2026-04-12T10:00:00Z"
}
```

## Connector
```json
{
  "id": "connector_uuid",
  "name": "ERP Sandbox",
  "connector_type": "ERP",
  "auth_type": "service_account",
  "capabilities": ["read", "write"],
  "allowed_actions": ["create_purchase_suggestion", "create_transfer_request"],
  "status": "healthy",
  "config": {
    "endpoint": "https://erp-sandbox.internal",
    "timeout_ms": 10000
  },
  "secret_ref": "vault://customer/prod/erp-sandbox",
  "last_sync_at": "2026-04-12T09:58:00Z"
}
```

## Source
```json
{
  "id": "source_uuid",
  "workspace_id": "workspace_uuid",
  "runtime_id": "runtime_uuid",
  "name": "Linear MCP",
  "source_type": "mcp",
  "connection_status": "connected",
  "connection_error": "",
  "last_test_message": "连接测试通过，MCP 会话已成功建立",
  "last_tested_at": "2026-04-14T10:00:00Z",
  "mcp": {
    "transport": "http",
    "url": "https://mcp.linear.app",
    "auth_type": "oauth",
    "client_id": "client-id"
  },
  "auth_state": {
    "auth_type": "oauth",
    "configured": true,
    "preview": "Bearer ••••abcd",
    "updated_at": "2026-04-14T09:59:00Z"
  },
  "tool_summary": {
    "total": 3,
    "read_only": 2,
    "write": 1,
    "unknown": 0,
    "last_seen_at": "2026-04-14T10:01:00Z"
  },
  "latest_run": {
    "id": "source_run_uuid",
    "run_type": "discover_tools",
    "status": "completed",
    "tool_name": "",
    "summary": "已发现 3 个工具"
  },
  "created_at": "2026-04-14T09:58:00Z",
  "updated_at": "2026-04-14T10:01:00Z"
}
```

## SourceTool
```json
{
  "id": "tool_uuid",
  "source_id": "source_uuid",
  "workspace_id": "workspace_uuid",
  "name": "list_issues",
  "title": "列出任务",
  "description": "Read-only tool for listing issues",
  "safety": "read_only",
  "input_schema": {},
  "annotations": {
    "readOnlyHint": true
  },
  "last_seen_at": "2026-04-14T10:01:00Z",
  "created_at": "2026-04-14T10:01:00Z",
  "updated_at": "2026-04-14T10:01:00Z"
}
```

## SourceRun
```json
{
  "id": "source_run_uuid",
  "source_id": "source_uuid",
  "workspace_id": "workspace_uuid",
  "runtime_id": "runtime_uuid",
  "run_type": "call_tool",
  "status": "completed",
  "tool_name": "list_issues",
  "request_payload": {
    "arguments": {}
  },
  "result_payload": {
    "connection_status": "connected",
    "message": "工具调用成功",
    "tool_result": {
      "is_error": false
    }
  },
  "summary": "工具调用成功",
  "error_message": "",
  "started_at": "2026-04-14T10:02:00Z",
  "completed_at": "2026-04-14T10:02:01Z",
  "created_at": "2026-04-14T10:02:00Z",
  "updated_at": "2026-04-14T10:02:01Z"
}
```

---

## 决策单接口

## GET /api/decisions

### Query 参数
| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `phase` | string | 否 | 多值可逗号分隔 |
| `risk_level` | string | 否 | 多值可逗号分隔 |
| `execution_mode` | string | 否 | 多值可逗号分隔 |
| `decision_type` | string | 否 | 例如 replenishment / procurement / transfer |
| `project_id` | string | 否 | 专题过滤 |
| `object_type` | string | 否 | 业务对象类型 |
| `object_id` | string | 否 | 业务对象 ID |
| `assignee_id` | string | 否 | 负责人 |
| `page` | int | 否 | 默认 1 |
| `page_size` | int | 否 | 默认 20，最大 100 |

### 响应
```json
{
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 123
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/decisions

### 请求体
```json
{
  "title": "华东仓 SKU123 断货风险处理",
  "description": "由控制塔告警自动生成",
  "project_id": "project_uuid",
  "domain": "supply_chain",
  "decision_type": "replenishment",
  "object_type": "sku_warehouse",
  "object_id": "SKU123#WH_EAST",
  "objective": {
    "target_service_level": 0.97
  },
  "constraints": [
    {"type": "budget_limit", "value": 500000},
    {"type": "lead_time_days", "value": 7}
  ],
  "risk_level": "high",
  "execution_mode": "suggestion",
  "seed_snapshot": true
}
```

### 说明
- 同时创建 `issue` 与 `decision_case`
- `project_id` 写入 `issue.project_id`，不在 `decision_case` 重复存储
- `seed_snapshot=true` 时同步生成首个快照
- 未显式传入 `execution_mode` 时，后端默认回落到 `suggestion`

### 响应
返回 `DecisionCaseDetail`

---

## GET /api/decisions/{id}

### 说明
聚合返回 issue + decision_case + latest snapshot + latest scenario + latest recommendation + approval summary + actions summary。

### 响应
返回 `DecisionCaseDetail`

---

## PATCH /api/decisions/{id}

### 请求体
```json
{
  "title": "新标题",
  "project_id": "project_uuid",
  "risk_level": "critical",
  "execution_mode": "suggestion",
  "objective": {},
  "constraints": [],
  "phase": "recommending"
}
```

### 规则
- `phase` 变更受状态机限制
- `project_id` 更新到 `issue.project_id`
- `execution_mode` 从 `automatic` 改为其他模式允许；反向切换需要权限校验

---

## 诊断与仿真

## POST /api/decisions/{id}/diagnose

### 请求体
```json
{
  "agent_ids": ["agent_uuid_1", "agent_uuid_2"],
  "runtime_id": "runtime_uuid",
  "refresh_snapshot": true,
  "notes": "优先分析需求激增与在途不足"
}
```

### 响应
```json
{
  "data": {
    "run_id": "diag_run_uuid",
    "phase": "diagnosing",
    "status": "queued"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/decisions/{id}/scenarios/run

### 请求体
```json
{
  "runtime_id": "runtime_uuid",
  "snapshot_id": "snapshot_uuid",
  "candidate_actions": [
    "replenishment",
    "transfer",
    "procurement"
  ],
  "parameters": {
    "service_level_target": 0.97,
    "max_budget": 500000,
    "max_lead_time_days": 7
  }
}
```

### 响应
```json
{
  "data": {
    "scenario_run_id": "scenario_uuid",
    "status": "queued"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## GET /api/decisions/{id}/scenarios

### 响应
```json
{
  "data": {
    "items": [
      {
        "id": "scenario_uuid",
        "status": "succeeded",
        "snapshot_id": "snapshot_uuid",
        "options": [
          {
            "id": "option_uuid",
            "rank": 1,
            "action_type": "transfer",
            "score": 0.91,
            "cost": 120000,
            "lead_time_hours": 12,
            "stockout_rate": 0.03,
            "service_level": 0.97
          }
        ]
      }
    ]
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## 推荐方案

## POST /api/decisions/{id}/recommend

### 请求体
```json
{
  "scenario_run_id": "scenario_uuid",
  "selected_option_id": "option_uuid",
  "fallback_option_ids": ["option_uuid_2", "option_uuid_3"],
  "generator_runtime_id": "runtime_uuid"
}
```

### 响应
```json
{
  "data": {
    "recommendation_id": "recommendation_uuid",
    "phase": "recommending",
    "confidence": 0.86
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

### 说明
系统也可在不传 `selected_option_id` 时自动按 score 最高方案生成主推荐。

---

## 审批流

## POST /api/decisions/{id}/submit-approval

### 请求体
```json
{
  "recommendation_id": "recommendation_uuid",
  "approval_chain": [
    {
      "approver_type": "member",
      "approver_id": "member_uuid_1"
    }
  ],
  "summary": "建议优先调拨，预计 12 小时恢复 97% 服务水平"
}
```

### 响应
```json
{
  "data": {
    "approval_id": "approval_uuid",
    "approval_status": "pending",
    "phase": "awaiting_approval"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/approvals/{id}/approve

### 请求体
```json
{
  "comment": "同意执行",
  "notify": true
}
```

### 响应
```json
{
  "data": {
    "approval_id": "approval_uuid",
    "approval_status": "approved",
    "decision_phase": "approved"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/approvals/{id}/reject

### 请求体
```json
{
  "comment": "预算超限，请重算",
  "return_phase": "recommending"
}
```

### 响应
```json
{
  "data": {
    "approval_id": "approval_uuid",
    "approval_status": "rejected",
    "decision_phase": "recommending"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## 动作执行

## POST /api/decisions/{id}/execute

### Header
`Idempotency-Key: action-<uuid>`

### 请求体
```json
{
  "recommendation_id": "recommendation_uuid",
  "connector_id": "connector_uuid",
  "actions": [
    {
      "action_type": "create_transfer_request",
      "target": {
        "from_warehouse": "WH_SOUTH",
        "to_warehouse": "WH_EAST",
        "sku_id": "SKU123"
      },
      "payload": {
        "quantity": 1000
      }
    }
  ]
}
```

### 响应
```json
{
  "data": {
    "action_run_ids": ["action_uuid_1"],
    "execution_status": "queued"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

### 规则
- `suggestion` 模式下调用返回 `PRECONDITION_FAILED`
- `approval` 模式必须审批通过
- `automatic` 模式必须命中白名单与阈值

---

## POST /api/actions/{id}/rollback

### 请求体
```json
{
  "reason": "外部库存基线变化，撤销建议单"
}
```

### 响应
```json
{
  "data": {
    "action_run_id": "action_uuid_1",
    "execution_status": "rolled_back"
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## 控制塔与指标

## GET /api/tower/alerts

### Query 参数
| 参数 | 类型 | 说明 |
|---|---|---|
| `severity` | string | low/medium/high/critical |
| `alert_type` | string | stockout_risk / supplier_delay / imbalance / forecast_error |
| `object_type` | string | 业务对象类型 |
| `keyword` | string | 关键字 |
| `page` | int | 分页 |
| `page_size` | int | 分页 |

### 响应
```json
{
  "data": {
    "items": [],
    "page": 1,
    "page_size": 20,
    "total": 20
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/tower/alerts/{id}/decision

### 请求体
```json
{
  "project_id": "project_uuid",
  "title": "由告警生成的决策单",
  "execution_mode": "suggestion"
}
```

### 行为
- 基于 alert 自动填充 object / summary / risk_level
- 自动生成 snapshot
- 未显式传入 `execution_mode` 时，默认使用 `suggestion`

### 响应
返回 `DecisionCaseDetail`

---

## GET /api/metrics/snapshots

### Query 参数
| 参数 | 类型 | 说明 |
|---|---|---|
| `decision_id` | string | 决策单 ID |
| `latest_only` | bool | 是否只返回最新 |
| `snapshot_id` | string | 精确查询 |

### 响应
```json
{
  "data": {
    "items": [
      {
        "id": "snapshot_uuid",
        "decision_id": "issue_uuid",
        "captured_at": "2026-04-12T10:00:00Z",
        "metrics": {
          "inventory_qty": 1200,
          "coverage_days": 2.1,
          "forecast_7d": 3500,
          "service_level": 0.91
        },
        "source_refs": [
          {"type": "wms", "ref": "snapshot_001"}
        ]
      }
    ]
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## 连接器接口

## GET /api/connectors

### 响应
```json
{
  "data": {
    "items": []
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## POST /api/connectors

### 请求体
```json
{
  "name": "ERP Sandbox",
  "connector_type": "ERP",
  "auth_type": "service_account",
  "capabilities": ["read", "write"],
  "allowed_actions": ["create_purchase_suggestion", "create_transfer_request"],
  "config": {
    "base_url": "https://erp-sandbox.internal"
  },
  "secret_ref": "secret://erp/sandbox"
}
```

### 说明
- `config` 仅保存非敏感配置
- 密钥、口令、令牌等敏感信息通过 `secret_ref` 引用

### 响应
返回 `Connector`

---

## PATCH /api/connectors/{id}

### 请求体
```json
{
  "name": "ERP Sandbox v2",
  "allowed_actions": ["create_purchase_suggestion"],
  "status": "disabled"
}
```

---

## POST /api/connectors/{id}/test

### 请求体
```json
{
  "operation": "healthcheck"
}
```

### 响应
```json
{
  "data": {
    "status": "healthy",
    "latency_ms": 143
  },
  "meta": {"request_id": "req_xxx"},
  "error": null
}
```

---

## Runtime 扩展响应字段

为了让执行环境页面可展示更多治理信息，建议在原有 runtime 返回结构基础上补充：

```json
{
  "id": "runtime_uuid",
  "name": "SQL Runtime - DWH",
  "runtime_mode": "remote",
  "executor_kind": "sql_runner",
  "network_zone": "intranet-data",
  "credential_scope": ["dwh_ro"],
  "allowed_actions": ["run_select_query"],
  "approval_required": false
}
```

---

## 错误码建议

| code | 含义 |
|---|---|
| `VALIDATION_FAILED` | 参数缺失或不合法 |
| `PRECONDITION_FAILED` | 前置状态不满足，如审批未通过 |
| `IDEMPOTENCY_CONFLICT` | 重复执行 |
| `CONNECTOR_ERROR` | 连接器调用失败 |
| `RUNTIME_ERROR` | 执行环境调用失败 |
| `FORBIDDEN` | 权限不足 |
| `NOT_FOUND` | 资源不存在 |

---

## 合约完成定义

以下条件同时成立，合约才能冻结：

- 决策单列表/详情字段稳定
- 仿真/推荐/审批/执行链路全部有接口
- 连接器与控制塔接口可用于工作台和详情页
- 所有写接口都有错误码和前置条件定义
- `api_contract.md` 与后端 contract tests 一致
