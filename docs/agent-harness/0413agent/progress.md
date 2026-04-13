# Progress Tracker — 0413 Agent Harness

## 第二批：形成可见产品

| Task ID | Status | Notes |
|---------|--------|-------|
| DB-P0-014 | DONE | decision_case 表 + 8 sqlc 查询 |
| DB-P0-015 | DONE | 4 迁移(6 表) + 6 sqlc 查询 |
| BE-P0-016 | DONE | decision handler 688 行, 5 routes, Go build PASS |
| FE-P0-007 | DONE | Inbox → 工作台 (4 stat cards + alerts + todos + activity) |
| FE-P0-008 | DONE | Issues → 决策单中心 (5 new filters + decision metadata badges) |
| FE-P0-009 | DONE | Issue详情八Tab (概览/快照/诊断/仿真/推荐/审批/执行/协同) |
| FE-P0-010 | DONE | Projects→专题中心 (4模板+中文标签+关联决策区块) |

## 第一批（已完成）
- BASE-P0-001~003: DONE
- I18N-P0-004~006: DONE (100% 中文覆盖)

## 变更日志
- 2026-04-13: 第一批全部完成
- 2026-04-13: DB-P0-014, DB-P0-015 完成
- 2026-04-13: BE-P0-016 完成 (decision handler + routes + events)
- 2026-04-13: 下一步: 重新部署测试 → FE-P0-007/008
- 2026-04-13: FE-P0-007 完成 (Inbox→工作台: dashboard+alerts+todos+activity)
- 2026-04-13: FE-P0-008 完成 (Issues→决策单中心: 5 decision filters + risk/phase/execution badges)
- 2026-04-13: 前端端口映射修复 (FRONTEND_PORT 3000→22202, .env 重复定义问题)
- 2026-04-13: 下一步: FE-P0-009 (Issue详情八Tab) + FE-P0-010 (Projects专题中心)
- 2026-04-13: FE-P0-009 完成 (8-tab decision detail: overview/snapshots/diagnosis/simulation/recommendation/approval/execution/collaboration)
- 2026-04-13: FE-P0-010 完成 (Projects→专题中心: 4 recommended templates, Chinese status/priority labels, linked decision section)
- 2026-04-13: **第二批全部完成！** 下一步: 第三批 BE-P1-017~023
- 2026-04-13: BE-P1-017 完成 (scenario handler: diagnose + scenarios/run + scenarios list)
- 2026-04-13: BE-P1-020 完成 (connector handler: CRUD + test + mock adapter)
- 2026-04-13: BE-P1-021 完成 (runtime_executor sidecar: migration 045 + executor_kind filter)
- 2026-04-13: BE-P1-022 完成 (tower alerts + alert→decision conversion + metrics snapshots)
- 2026-04-13: BE-P1-018 完成 (recommendation + approval state machine: 6 routes, recommend/submit-approval/approve/reject/list)
- 2026-04-13: BE-P1-019 完成 (action execution + idempotency + rollback: 4 routes, execute/rollback/list/get)
- 2026-04-13: GOV-P1-023 完成 (audit chain: audit_event table + immutability trigger + 3 query routes + hooks in all decision handlers)
- 2026-04-13: **第三批全部完成！** 下一步: 第四批 FE-P1-011~013 + QA/DEP
- 2026-04-13: FE-P1-011 完成 (专家网络: 7 domain badges + capability matrix dots + 全中文标签)
- 2026-04-13: FE-P1-012 完成 (执行环境: 5 executor_kind badges + 资源配额卡片 + 全中文标签)
- 2026-04-13: FE-P1-013 完成 (技能包: 7 domain badges + 3 供应链模板 + 全中文标签)
- 2026-04-13: **前端任务全部完成！** 下一步: QA-P1-024~026 + DEP-P1-027
- 2026-04-13: QA-P1-024 完成 (seed_decisions.sql: 10 决策单覆盖全生命周期)
- 2026-04-13: QA-P0-025 完成 (decision_pipeline_test.go: 7 API 合约测试)
- 2026-04-13: DEP-P1-027 完成 (deployment-demo.md 部署手册)
- 2026-04-13: 下一步: QA-P0-026 (E2E 决策流程测试) — 最后一个任务
- 2026-04-13: **QA-P0-026 完成!** E2E 全流程测试 9/9 PASS (create→diagnose→simulate→recommend→submit→approve→execute→idempotency→audit)
- 2026-04-13: 修复: decision_approval.approver_type 约束增加 'member' 支持
- 2026-04-13: 修复: Dockerfile 添加 testdeps/ 复制以解决 testify replace 问题
- 2026-04-13: 修复: workspace.issue_counter 与 max(number) 对齐 (seed 数据导致的偏移)
- 2026-04-13: **全部 27 个任务完成！项目可用于演示**

## 第三批：形成可演示闭环

| Task ID | Status | Notes |
|---------|--------|-------|
| BE-P1-017 | DONE | scenario handler + diagnose/scenarios/run routes |
| BE-P1-018 | DONE | 推荐方案与审批状态机 (recommendation.go 660行 + tests) |
| BE-P1-019 | DONE | 动作执行、幂等与回滚 (action.go 426行 + tests) |
| BE-P1-020 | DONE | connector handler + mock adapter + 5 routes |
| BE-P1-021 | DONE | runtime_executor sidecar + migration 045 + executor_kind filter |
| BE-P1-022 | DONE | tower alerts + alert→decision + metrics snapshots API |
| GOV-P1-023 | DONE | 审计链 (audit.go 294行 + migration 046 + immutability trigger) |

## 第四批：前端适配 + 质量保障 + 部署

| Task ID | Status | Notes |
|---------|--------|-------|
| FE-P1-011 | DONE | Agents → 专家网络 (domain badges + capability matrix + 中文标签) |
| FE-P1-012 | DONE | Runtimes → 执行环境 (executor_kind badges + 资源配额 + 中文标签) |
| FE-P1-013 | DONE | Skills → 技能包 (domain detection + 供应链模板 + 中文标签) |
| QA-P1-024 | DONE | 种子数据 (10+ 决策单覆盖全生命周期) |
| QA-P0-025 | DONE | API 合约测试 (recommendation/approval/action/audit) |
| QA-P0-026 | DONE | E2E 决策流程测试 (9/9 步骤全部通过, 含幂等性验证) |
| DEP-P1-027 | DONE | 部署手册 (Docker + 数据库初始化 + 端口配置) |

## 部署信息
- 地址: http://localhost:22202
- 账号: admin@local / admin123
- 部署方式: Orb Docker

## 预存问题
- `.next/dev/types/validator.ts` 引用不存在的页面 (修复: rm -rf apps/web/.next)
