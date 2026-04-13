# Multica 私有化部署与运行治理（deployment.md）

## 部署目标

本文件面向“单客户、单实例、内网私有化部署”的供应链 Demo 交付，不覆盖多租户 SaaS。

---

## 推荐部署拓扑

## 最小 Demo 拓扑
```text
[Browser]
   |
[Nginx / Caddy]
   |-------------------------------|
   |                               |
[Next.js Web]                 [Go API]
                                   |
                        [PostgreSQL + pgvector]
                                   |
               -----------------------------------------
               |                 |                     |
         [LLM Runtime]   [Python / SQL Runtime]  [Connector Runtime]
                                   |
                              [Mock / Sandbox]
```

## 客户内网建议拓扑
```text
[User Browser]
    |
[Ingress / Reverse Proxy]
    |
-------------------------------
|             |               |
[Web]        [API]       [Object Storage]
                 |
            [PostgreSQL]
                 |
-------------------------------------------
|                |               |         |
[LLM Runtime] [SQL Runtime] [Optimizer] [Connector Runtime]
                                           |
                              ---------------------------
                              |            |            |
                             ERP          OMS          WMS
```

---

## 服务拆分建议

### 必选服务
- Web（Next.js）
- API（Go）
- PostgreSQL
- 反向代理

### 强烈建议独立的服务
- LLM Runtime
- Python / SQL Runtime
- Optimizer Runtime
- Connector Runtime
- Object Storage

### 演示阶段可先 mock 的服务
- ERP 写接口
- OMS/WMS 实时接口
- 供应商系统接口

---

## 环境变量建议

## 基础配置
```env
DATABASE_URL=postgres://user:pass@postgres:5432/multica?sslmode=disable
JWT_SECRET=replace_me
FRONTEND_ORIGIN=https://app.customer.local
CORS_ALLOWED_ORIGINS=https://app.customer.local
```

## 前端配置
```env
NEXT_PUBLIC_API_URL=https://api.customer.local
NEXT_PUBLIC_WS_URL=wss://api.customer.local/ws
DEFAULT_LOCALE=zh-CN
SUPPORTED_LOCALES=zh-CN,en-US
```

## 对象存储
```env
S3_BUCKET=multica-demo
S3_REGION=ap-southeast-1
S3_ENDPOINT=https://s3.customer.local
S3_ACCESS_KEY_ID=replace_me
S3_SECRET_ACCESS_KEY=replace_me
```

## 连接器与执行器
```env
CONNECTOR_SECRET_PROVIDER=secrets_manager
DECISION_DEFAULT_MODE=approval
ACTION_AUTO_WHITELIST=refresh_snapshot,close_resolved_alert,push_internal_notification
RUNTIME_REGISTRATION_TOKEN=replace_me
```

## Demo 控制开关
```env
DEMO_MODE=true
ENABLE_CONNECTOR_WRITE=false
ENABLE_APPROVAL_FLOW=true
ENABLE_AUTO_EXECUTION=false
```

---

## Docker Compose 扩展示意

```yaml
services:
  web:
    build: ./apps/web
    env_file: .env
    depends_on:
      - api

  api:
    build: ./server
    env_file: .env
    depends_on:
      - postgres

  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_DB: multica
      POSTGRES_USER: multica
      POSTGRES_PASSWORD: multica

  llm-runtime:
    image: customer/llm-runtime:latest
    env_file: .env

  py-sql-runtime:
    image: customer/python-sql-runtime:latest
    env_file: .env

  connector-runtime:
    image: customer/connector-runtime:latest
    env_file: .env
```

### 注意
- 执行器建议独立部署，不要全部塞进 API 进程。
- Demo 阶段也应预留水平扩展位。

---

## 网络与安全策略

## 网络区建议
| 区域 | 访问对象 |
|---|---|
| Web 区 | Browser → Web / API |
| 应用区 | API → PostgreSQL / Object Storage |
| 数据区 | SQL Runtime → DWH / BI |
| 集成区 | Connector Runtime → ERP / OMS / WMS |

## 基本原则
1. Browser 不直连数据库。
2. Web 不直连 ERP/OMS/WMS。
3. 只有 Connector Runtime 可访问写接口。
4. SQL Runtime 优先只读凭证。
5. 凭证不写入业务日志。

## Secrets 管理
建议接入：
- AWS Secrets Manager
- Vault
- 客户内部密钥管理系统

避免：
- 明文写在 `.env` 长期留存
- 把 token/secret 落到前端可见接口

---

## 数据接入策略

## 读真实
优先接入：
- DWH / BI
- ERP 读接口
- OMS 读接口
- WMS 读接口

## 写受控
写操作优先级：
1. 写 mock / sandbox
2. 写建议单 / 中间表
3. 写正式单据（仅审批通过或自动白名单）

## Demo 建议
第一阶段默认：
- `ENABLE_CONNECTOR_WRITE=false`
- 前台完整演示闭环
- 后台仍能看到 action_run 与 external_ref（mock）

---

## 执行环境部署建议

## LLM Runtime
用于：
- 总结
- 诊断说明
- 推荐文案生成
- 审批摘要生成

## SQL Runtime
用于：
- 拉取指标快照
- 查询历史趋势
- 读取 ODS/DWH 汇总表

## Python / Optimizer Runtime
用于：
- 预测
- 仿真
- 补货/调拨/采购求解

## Connector Runtime
用于：
- 调用 ERP / OMS / WMS API
- 记录写入动作与回滚动作

### 原则
业务用户机器不承担关键执行器职责。优先使用内网专用执行节点。

---

## 运维与可观测性

## 日志
日志至少包含：
- request_id
- workspace_id
- decision_id
- action_run_id
- connector_id
- runtime_id
- actor_type / actor_id

## 指标
建议暴露：
- API 响应时间
- 仿真时长
- connector 成功率
- action_run 成功率
- runtime 心跳
- 队列长度

## Trace（建议）
关键链路：
- 告警生成
- 快照抓取
- 仿真运行
- 推荐生成
- 审批提交
- 动作执行

---

## 演示数据与初始化

## 初始化内容
- 1 个业务空间
- 4 个专题
- 4 个供应链场景
- 4 个 Agent
- 3 类 Runtime
- 1 套 Connector
- 若干决策单与审批记录

## 初始化方式
- migration 后执行 seed
- 或通过 bootstrapping job 注入

## 演示账号建议
- 平台管理员
- 业务负责人
- 计划员
- 只读访客

---

## 升级与回滚策略

## 升级顺序
1. PostgreSQL migration
2. API
3. Runtime 服务
4. Web

## 回滚原则
- 先停写动作
- 回滚 Web / API
- 必要时回滚 runtime
- 数据库只在有 down migration 时回退；否则采用兼容版本重新部署

## 动作执行保护
升级期间：
- 临时关闭自动执行
- 审批模式改为只生成建议
- 避免升级中途写正式业务系统

---

## 非功能目标

| 项目 | 目标 |
|---|---|
| 首屏响应 | 核心列表页 < 3 秒 |
| 单次仿真 | 示例场景 < 60 秒 |
| 审计可追溯 | 100% 写动作可追踪 |
| 演示稳定性 | 彩排期间不因执行器断连中断 |
| 安全性 | 默认只读，写入受控 |

---

## 交付物清单

部署层至少交付：

- `.env.example`
- `docker-compose.override.yml`
- `deployment.md`
- `seed` 脚本
- 演示账号清单
- 回滚手册
- 运行拓扑说明

---

## 部署完成定义

满足以下条件后才算“可交付部署”：

- Web / API / PostgreSQL / Runtime 可正常启动
- 默认中文
- 至少一条决策闭环能跑通
- mock/sandbox 写入可演示
- 自动模式默认关闭
- 所有 secrets 不以明文留在仓库
- 有升级与回滚步骤
