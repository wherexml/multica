-- 决策演示种子数据：覆盖识别、诊断、仿真、推荐、审批、执行、监控全生命周期。
-- 说明：
-- 1. 所有核心关联记录使用固定 UUID，便于重复执行和跨表引用。
-- 2. workspace_id 与 user_id 动态取数据库中的第一条记录。
-- 3. 所有插入都使用 ON CONFLICT DO NOTHING，确保文件可重复执行。

-- 演示项目与执行连接器
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
), usr AS (
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO project (
    id,
    workspace_id,
    title,
    description,
    icon,
    status,
    lead_type,
    lead_id,
    priority,
    created_at,
    updated_at
)
SELECT
    '70000000-0000-0000-0000-000000000001'::uuid,
    ws.id,
    '供应链决策演示项目',
    '用于展示从识别、诊断、推荐、审批到执行和监控的完整供应链决策链路。',
    'package',
    'in_progress',
    'member',
    usr.id,
    'high',
    TIMESTAMPTZ '2026-04-01 09:00:00+08',
    TIMESTAMPTZ '2026-04-13 10:30:00+08'
FROM ws
CROSS JOIN usr
ON CONFLICT (id) DO NOTHING;

WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
), usr AS (
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO connector (
    id,
    workspace_id,
    name,
    kind,
    base_url,
    capability,
    config,
    allowed_actions,
    health_status,
    last_health_check,
    created_at,
    updated_at
)
SELECT
    '76000000-0000-0000-0000-000000000001'::uuid,
    ws.id,
    '供应链执行连接器',
    'erp',
    'https://demo-erp.internal',
    'read_write',
    jsonb_build_object(
        'owner', '供应链中台',
        'region', 'cn-east-1',
        'note', '用于调拨、采购和补货动作演示'
    ),
    ARRAY[
        'inventory.transfer.create',
        'purchase.order.create',
        'shipment.route.update'
    ]::text[],
    'healthy',
    TIMESTAMPTZ '2026-04-13 08:00:00+08',
    TIMESTAMPTZ '2026-04-01 09:00:00+08',
    TIMESTAMPTZ '2026-04-13 08:00:00+08'
FROM ws
CROSS JOIN usr
ON CONFLICT (id) DO NOTHING;

-- 核心决策 issue 与 decision_case：共 10 条，覆盖全部关键阶段
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
), usr AS (
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1
), decision_seed (
    issue_id,
    title,
    description,
    issue_status,
    priority,
    assignee_type,
    domain,
    decision_type,
    object_type,
    object_id,
    objective,
    constraints,
    risk_level,
    execution_mode,
    phase,
    approval_status,
    execution_status,
    created_at,
    updated_at,
    sort_order
) AS (
    VALUES
        (
            '71000000-0000-0000-0000-000000000001'::uuid,
            '季节性备货决策：端午礼盒华南预储',
            '为端午礼盒旺季提前锁定华南仓储容量与包材，避免节前集中补货造成缺货。',
            'backlog',
            'high',
            ''::text,
            'supply_chain',
            'seasonal_planning',
            'sku_family',
            'FESTIVAL-GIFT-SOUTH',
            '在节前两周完成华南区域礼盒安全库存规划，保障重点渠道首发不断货。',
            '预算增量不超过 180 万元，冷库与常温仓总库容利用率不得超过 85%，不新增临时仓。',
            'high',
            'manual',
            'identified',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-12 09:00:00+08',
            TIMESTAMPTZ '2026-04-12 09:00:00+08',
            1
        ),
        (
            '71000000-0000-0000-0000-000000000002'::uuid,
            '价格波动应对：PET 包材锁价窗口评估',
            'PET 原料近两周波动明显，需要判断是否提前锁定二季度包材价格。',
            'backlog',
            'medium',
            ''::text,
            'supply_chain',
            'price_hedge',
            'material',
            'PET-RESIN-Q2',
            '在不压缩现金流的前提下评估锁价和分批采购方案，降低二季度包材成本波动。',
            '锁价金额不超过月均采购额的 1.2 倍，供应商账期不能缩短，仓储周转天数维持在 28 天以内。',
            'medium',
            'manual',
            'identified',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-12 14:30:00+08',
            TIMESTAMPTZ '2026-04-12 14:30:00+08',
            2
        ),
        (
            '71000000-0000-0000-0000-000000000003'::uuid,
            '供应商风险评估：华东纸箱供应商交付异常',
            '华东主纸箱供应商连续三周 OTIF 低于目标，需要识别断供风险并准备缓释方案。',
            'in_progress',
            'urgent',
            'member',
            'supply_chain',
            'risk_mitigation',
            'supplier',
            'SUP-BOX-EAST-01',
            '识别主供应商履约下滑的根因与影响范围，明确替代资源与切换条件。',
            '不能影响 4 月大促订单出库，新增替代供应商的质检周期不得超过 5 天，价格上浮控制在 6% 以内。',
            'critical',
            'semi_auto',
            'diagnosing',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-11 10:00:00+08',
            TIMESTAMPTZ '2026-04-13 09:10:00+08',
            3
        ),
        (
            '71000000-0000-0000-0000-000000000004'::uuid,
            '物流路径优化：西南冷链干线切换',
            '西南暴雨影响原有冷链干线时效，需要比较改道与中转方案对成本和妥投率的影响。',
            'in_progress',
            'high',
            'member',
            'supply_chain',
            'route_optimization',
            'route',
            'ROUTE-SW-COLDCHAIN',
            '在保证 48 小时冷链送达的前提下，优化西南区域干线路径与中转节点。',
            '运输成本增幅不超过 8%，冷链破损率不得高于 0.3%，需要覆盖成都与重庆双仓。',
            'medium',
            'auto',
            'simulating',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-10 15:00:00+08',
            TIMESTAMPTZ '2026-04-13 08:40:00+08',
            4
        ),
        (
            '71000000-0000-0000-0000-000000000005'::uuid,
            '区域库存平衡决策：华北与华东库存再平衡',
            '华北仓积压而华东仓临近断货，需要形成跨区再平衡建议。',
            'in_review',
            'medium',
            'member',
            'supply_chain',
            'inventory_rebalance',
            'region_inventory',
            'INV-BALANCE-NORTH-EAST',
            '在不增加总库存的前提下提升重点 SKU 的全国可得率，缩短跨区缺货恢复时间。',
            '跨区调拨运费不得超过本周预算 40 万元，调拨后各仓安全库存覆盖天数不低于 7 天。',
            'low',
            'semi_auto',
            'recommending',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-09 11:30:00+08',
            TIMESTAMPTZ '2026-04-13 09:20:00+08',
            5
        ),
        (
            '71000000-0000-0000-0000-000000000006'::uuid,
            '预测修正决策：618 零食礼包销量修正',
            '最新投放计划提升了流量预期，需要修正 618 零食礼包销量预测并同步采购节奏。',
            'in_review',
            'high',
            'member',
            'supply_chain',
            'demand_forecast',
            'forecast_cycle',
            'FC-618-SNACK-2026',
            '在 24 小时内完成需求重估，并给出采购与产能爬坡建议，避免爆单后缺货。',
            '预测修正必须落在营销预算和产能排产能力范围内，产线加班不超过连续 5 天。',
            'high',
            'auto',
            'recommending',
            'draft',
            'pending',
            TIMESTAMPTZ '2026-04-08 16:00:00+08',
            TIMESTAMPTZ '2026-04-13 09:35:00+08',
            6
        ),
        (
            '71000000-0000-0000-0000-000000000007'::uuid,
            '紧急调拨决策：华南门店断货预警',
            '华南核心门店对爆款电解质饮料出现断货预警，需要在审批后立即跨仓调拨。',
            'in_review',
            'urgent',
            'member',
            'supply_chain',
            'emergency_allocation',
            'store_cluster',
            'STORE-CLUSTER-SOUTH-A',
            '在 12 小时内补齐重点门店可售库存，保证周末促销活动不断货。',
            '调拨过程中不能影响华东线上大促履约，单次门店补货车次不超过 6 车，先满足 A 类门店。',
            'critical',
            'semi_auto',
            'awaiting_approval',
            'pending',
            'pending',
            TIMESTAMPTZ '2026-04-07 13:20:00+08',
            TIMESTAMPTZ '2026-04-13 09:45:00+08',
            7
        ),
        (
            '71000000-0000-0000-0000-000000000008'::uuid,
            '供应商选择决策：替补包装膜供应商导入',
            '现有包装膜主供应商产能紧张，需要在两家备选厂商中确定导入对象。',
            'todo',
            'high',
            'member',
            'supply_chain',
            'supplier_selection',
            'supplier',
            'SUP-FILM-BACKUP',
            '在保障包材良率和交期的前提下，尽快完成替补供应商定版并释放试单。',
            '试单量不低于 30 万件，良率必须达到 98.5%，签约价格不能高于主供应商 5%。',
            'high',
            'manual',
            'approved',
            'approved',
            'pending',
            TIMESTAMPTZ '2026-04-06 10:10:00+08',
            TIMESTAMPTZ '2026-04-13 08:50:00+08',
            8
        ),
        (
            '71000000-0000-0000-0000-000000000009'::uuid,
            '爆品保供决策：电解质饮料华东紧急补货',
            '华东大促提前放量，核心爆品库存在 18 小时内将跌破警戒线，需要立即执行补货。',
            'in_progress',
            'urgent',
            'member',
            'supply_chain',
            'emergency_allocation',
            'sku',
            'SKU-ELECTROLYTE-330ML',
            '通过跨区调拨和加急采购并行补货，确保华东渠道未来 72 小时不断货。',
            '需优先满足核心 KA 渠道，跨区调拨时不得低于调出仓 5 天安全库存，运输时效必须控制在 24 小时内。',
            'critical',
            'auto',
            'executing',
            'approved',
            'running',
            TIMESTAMPTZ '2026-04-05 17:30:00+08',
            TIMESTAMPTZ '2026-04-13 10:20:00+08',
            9
        ),
        (
            '71000000-0000-0000-0000-000000000010'::uuid,
            '爆品保供决策：无糖茶华北保供复盘',
            '华北区域无糖茶补货动作已完成，需要持续监控补货效果、库存回补速度与缺货恢复情况。',
            'done',
            'medium',
            'member',
            'supply_chain',
            'inventory_rebalance',
            'sku',
            'SKU-TEA-SUGARFREE-500ML',
            '确认上周保供动作是否达到预期，并沉淀后续复制的库存平衡策略。',
            '监控期内维持门店缺货率低于 1.5%，补货后周转天数不高于 11 天，不追加额外营销投放。',
            'medium',
            'semi_auto',
            'monitoring',
            'approved',
            'completed',
            TIMESTAMPTZ '2026-04-05 09:40:00+08',
            TIMESTAMPTZ '2026-04-13 09:40:00+08',
            10
        )
), base AS (
    SELECT
        COALESCE(MAX(number), 0) AS max_number,
        COALESCE(MAX(position), 0) AS max_position
    FROM issue
    WHERE workspace_id = (SELECT id FROM ws)
), inserted_issue AS (
    INSERT INTO issue (
        id,
        workspace_id,
        title,
        description,
        status,
        priority,
        assignee_type,
        assignee_id,
        creator_type,
        creator_id,
        project_id,
        number,
        position,
        created_at,
        updated_at
    )
    SELECT
        seed.issue_id,
        ws.id,
        seed.title,
        seed.description,
        seed.issue_status,
        seed.priority,
        NULLIF(seed.assignee_type, ''),
        CASE
            WHEN seed.assignee_type = '' THEN NULL
            ELSE usr.id
        END,
        'member',
        usr.id,
        '70000000-0000-0000-0000-000000000001'::uuid,
        base.max_number + seed.sort_order,
        base.max_position + seed.sort_order,
        seed.created_at,
        seed.updated_at
    FROM decision_seed AS seed
    CROSS JOIN ws
    CROSS JOIN usr
    CROSS JOIN base
    ON CONFLICT (id) DO NOTHING
    RETURNING id
)
INSERT INTO decision_case (
    issue_id,
    workspace_id,
    project_id,
    domain,
    decision_type,
    object_type,
    object_id,
    objective,
    constraints,
    risk_level,
    execution_mode,
    phase,
    approval_status,
    execution_status,
    created_at,
    updated_at
)
SELECT
    seed.issue_id,
    ws.id,
    '70000000-0000-0000-0000-000000000001'::uuid,
    seed.domain,
    seed.decision_type,
    seed.object_type,
    seed.object_id,
    seed.objective,
    seed.constraints,
    seed.risk_level,
    seed.execution_mode,
    seed.phase,
    seed.approval_status,
    seed.execution_status,
    seed.created_at,
    seed.updated_at
FROM decision_seed AS seed
CROSS JOIN ws
ON CONFLICT (issue_id) DO NOTHING;

-- 推荐结论：覆盖推荐中、待审批和已批准阶段
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO decision_recommendation (
    id,
    decision_case_id,
    workspace_id,
    scenario_option_id,
    title,
    rationale,
    expected_impact,
    confidence_score,
    model_version,
    skill_version,
    created_at
)
SELECT
    rec.id,
    rec.decision_case_id,
    ws.id,
    NULL,
    rec.title,
    rec.rationale,
    rec.expected_impact,
    rec.confidence_score,
    rec.model_version,
    rec.skill_version,
    rec.created_at
FROM ws
CROSS JOIN (
    VALUES
        (
            '72000000-0000-0000-0000-000000000001'::uuid,
            '71000000-0000-0000-0000-000000000005'::uuid,
            '建议从华北仓向华东仓调拨 1.8 万箱',
            '华北仓覆盖天数高于目标 4.2 天，先行调拨可在不追加采购的情况下快速缓解华东缺货。',
            '预计华东重点 SKU 可得率提升 11%，全国总库存不增加，跨区调拨成本控制在预算内。',
            0.82::numeric,
            'scm-copilot-2026-04',
            'inventory-balance-v1',
            TIMESTAMPTZ '2026-04-13 09:18:00+08'
        ),
        (
            '72000000-0000-0000-0000-000000000002'::uuid,
            '71000000-0000-0000-0000-000000000006'::uuid,
            '建议将 618 零食礼包基线预测上调 18%',
            '营销新增直播场次与站外投放带来的增量流量已经在预约和加购数据中体现，上调需求预测更符合最新信号。',
            '预计可减少爆单缺货 23%，同时将加急采购比例压到 15% 以下。',
            0.89::numeric,
            'scm-copilot-2026-04',
            'forecast-correction-v2',
            TIMESTAMPTZ '2026-04-13 09:33:00+08'
        ),
        (
            '72000000-0000-0000-0000-000000000003'::uuid,
            '71000000-0000-0000-0000-000000000007'::uuid,
            '建议优先从华中仓向华南 A 类门店调拨 9600 箱',
            '华中仓当前库存健康且运输半径最优，优先支援可在最短时间内恢复核心门店可售。',
            '预计 6 小时内恢复 80% 重点门店货架陈列，周末活动缺货风险下降到 5% 以下。',
            0.93::numeric,
            'scm-copilot-2026-04',
            'emergency-allocation-v2',
            TIMESTAMPTZ '2026-04-13 09:42:00+08'
        ),
        (
            '72000000-0000-0000-0000-000000000004'::uuid,
            '71000000-0000-0000-0000-000000000008'::uuid,
            '建议导入苏州 B 厂作为包装膜替补供应商',
            '该供应商打样良率和交付承诺更稳定，且具备更快的产能切换能力，综合风险低于另一家备选。',
            '预计主供应商压力峰值可降低 30%，并将断膜风险从高降到中。',
            0.86::numeric,
            'scm-copilot-2026-04',
            'supplier-selection-v1',
            TIMESTAMPTZ '2026-04-13 08:45:00+08'
        )
) AS rec (
    id,
    decision_case_id,
    title,
    rationale,
    expected_impact,
    confidence_score,
    model_version,
    skill_version,
    created_at
)
ON CONFLICT (id) DO NOTHING;

-- 审批记录：包含待审批、已批准与执行前审批
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
), usr AS (
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO decision_approval (
    id,
    decision_case_id,
    workspace_id,
    approver_type,
    approver_id,
    status,
    comment,
    sort_order,
    created_at,
    updated_at
)
SELECT
    approval.id,
    approval.decision_case_id,
    ws.id,
    approval.approver_type,
    usr.id,
    approval.status,
    approval.comment,
    approval.sort_order,
    approval.created_at,
    approval.updated_at
FROM ws
CROSS JOIN usr
CROSS JOIN (
    VALUES
        (
            '74000000-0000-0000-0000-000000000001'::uuid,
            '71000000-0000-0000-0000-000000000007'::uuid,
            'user'::text,
            'pending'::text,
            '等待运营总监确认周末活动门店优先级后执行。',
            1,
            TIMESTAMPTZ '2026-04-13 09:43:00+08',
            TIMESTAMPTZ '2026-04-13 09:45:00+08'
        ),
        (
            '74000000-0000-0000-0000-000000000002'::uuid,
            '71000000-0000-0000-0000-000000000008'::uuid,
            'user'::text,
            'approved'::text,
            '同意导入替补供应商，要求试单结果在三天内回传。',
            1,
            TIMESTAMPTZ '2026-04-13 08:46:00+08',
            TIMESTAMPTZ '2026-04-13 08:50:00+08'
        ),
        (
            '74000000-0000-0000-0000-000000000003'::uuid,
            '71000000-0000-0000-0000-000000000009'::uuid,
            'user'::text,
            'approved'::text,
            '允许立即执行跨区调拨，并同步加急采购兜底。',
            1,
            TIMESTAMPTZ '2026-04-13 10:00:00+08',
            TIMESTAMPTZ '2026-04-13 10:05:00+08'
        )
) AS approval (
    id,
    decision_case_id,
    approver_type,
    status,
    comment,
    sort_order,
    created_at,
    updated_at
)
ON CONFLICT (id) DO NOTHING;

-- 上下文快照：提供诊断、仿真与监控阶段的度量输入
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO decision_context_snapshot (
    id,
    decision_case_id,
    workspace_id,
    source,
    source_ref,
    metrics,
    captured_at,
    created_at
)
SELECT
    snapshot.id,
    snapshot.decision_case_id,
    ws.id,
    snapshot.source,
    snapshot.source_ref,
    snapshot.metrics,
    snapshot.captured_at,
    snapshot.created_at
FROM ws
CROSS JOIN (
    VALUES
        (
            '75000000-0000-0000-0000-000000000001'::uuid,
            '71000000-0000-0000-0000-000000000003'::uuid,
            'supplier_scorecard'::text,
            'SUP-BOX-EAST-01/2026-W15'::text,
            jsonb_build_object(
                'otif', 0.71,
                'defect_rate', 0.028,
                'capacity_gap', 120000,
                'late_orders', 37
            ),
            TIMESTAMPTZ '2026-04-13 09:00:00+08',
            TIMESTAMPTZ '2026-04-13 09:01:00+08'
        ),
        (
            '75000000-0000-0000-0000-000000000002'::uuid,
            '71000000-0000-0000-0000-000000000004'::uuid,
            'tms_simulation'::text,
            'ROUTE-SW-COLDCHAIN/ALT-B'::text,
            jsonb_build_object(
                'eta_hours', 36,
                'cost_delta_pct', 0.054,
                'damage_risk', 0.002,
                'coverage_city_count', 18
            ),
            TIMESTAMPTZ '2026-04-13 08:32:00+08',
            TIMESTAMPTZ '2026-04-13 08:33:00+08'
        ),
        (
            '75000000-0000-0000-0000-000000000003'::uuid,
            '71000000-0000-0000-0000-000000000010'::uuid,
            'bi_monitor'::text,
            'SKU-TEA-SUGARFREE-500ML/D+3'::text,
            jsonb_build_object(
                'fill_rate', 0.987,
                'stockout_rate', 0.011,
                'sell_through_days', 9.4,
                'transfer_units', 18400
            ),
            TIMESTAMPTZ '2026-04-13 09:35:00+08',
            TIMESTAMPTZ '2026-04-13 09:36:00+08'
        )
) AS snapshot (
    id,
    decision_case_id,
    source,
    source_ref,
    metrics,
    captured_at,
    created_at
)
ON CONFLICT (id) DO NOTHING;

-- 执行动作：一个运行中、一个已完成
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO action_run (
    id,
    decision_case_id,
    workspace_id,
    idempotency_key,
    connector_id,
    action_type,
    request_payload,
    external_ref,
    rollback_payload,
    status,
    runtime_id,
    error_message,
    started_at,
    completed_at,
    created_at,
    updated_at
)
SELECT
    action.id,
    action.decision_case_id,
    ws.id,
    action.idempotency_key,
    action.connector_id,
    action.action_type,
    action.request_payload,
    action.external_ref,
    action.rollback_payload,
    action.status,
    gen_random_uuid(),
    action.error_message,
    action.started_at,
    action.completed_at,
    action.created_at,
    action.updated_at
FROM ws
CROSS JOIN (
    VALUES
        (
            '77000000-0000-0000-0000-000000000001'::uuid,
            '71000000-0000-0000-0000-000000000009'::uuid,
            'decision-action-71000000-0000-0000-0000-000000000009',
            '76000000-0000-0000-0000-000000000001'::uuid,
            'inventory.transfer.create'::text,
            jsonb_build_object(
                'sku', 'SKU-ELECTROLYTE-330ML',
                'from_warehouse', 'WH-CENTRAL-02',
                'to_warehouse', 'WH-EAST-03',
                'quantity', 24000,
                'priority', 'urgent'
            ),
            'ERP-TR-20260413-001'::text,
            jsonb_build_object(
                'action', 'inventory.transfer.cancel',
                'external_ref', 'ERP-TR-20260413-001'
            ),
            'running'::text,
            ''::text,
            TIMESTAMPTZ '2026-04-13 10:08:00+08',
            NULL::timestamptz,
            TIMESTAMPTZ '2026-04-13 10:07:30+08',
            TIMESTAMPTZ '2026-04-13 10:20:00+08'
        ),
        (
            '77000000-0000-0000-0000-000000000002'::uuid,
            '71000000-0000-0000-0000-000000000010'::uuid,
            'decision-action-71000000-0000-0000-0000-000000000010',
            '76000000-0000-0000-0000-000000000001'::uuid,
            'inventory.transfer.create'::text,
            jsonb_build_object(
                'sku', 'SKU-TEA-SUGARFREE-500ML',
                'from_warehouse', 'WH-EAST-01',
                'to_warehouse', 'WH-NORTH-02',
                'quantity', 18400,
                'priority', 'high'
            ),
            'ERP-TR-20260410-017'::text,
            jsonb_build_object(
                'action', 'inventory.transfer.cancel',
                'external_ref', 'ERP-TR-20260410-017'
            ),
            'completed'::text,
            ''::text,
            TIMESTAMPTZ '2026-04-10 15:10:00+08',
            TIMESTAMPTZ '2026-04-10 20:45:00+08',
            TIMESTAMPTZ '2026-04-10 15:09:30+08',
            TIMESTAMPTZ '2026-04-13 09:40:00+08'
        )
) AS action (
    id,
    decision_case_id,
    idempotency_key,
    connector_id,
    action_type,
    request_payload,
    external_ref,
    rollback_payload,
    status,
    error_message,
    started_at,
    completed_at,
    created_at,
    updated_at
)
ON CONFLICT (idempotency_key) DO NOTHING;

-- 审计轨迹：覆盖创建、快照、推荐、审批与执行节点
WITH ws AS (
    SELECT id
    FROM workspace
    ORDER BY created_at ASC
    LIMIT 1
), usr AS (
    SELECT id
    FROM "user"
    ORDER BY created_at ASC
    LIMIT 1
)
INSERT INTO audit_event (
    id,
    workspace_id,
    decision_case_id,
    actor_type,
    actor_id,
    action,
    target_type,
    target_id,
    old_state,
    new_state,
    metadata,
    ip_address,
    user_agent,
    created_at
)
SELECT
    event.id,
    ws.id,
    event.decision_case_id,
    event.actor_type,
    usr.id,
    event.action,
    event.target_type,
    event.target_id,
    event.old_state,
    event.new_state,
    event.metadata,
    event.ip_address,
    event.user_agent,
    event.created_at
FROM ws
CROSS JOIN usr
CROSS JOIN (
    VALUES
        (
            '78000000-0000-0000-0000-000000000001'::uuid,
            '71000000-0000-0000-0000-000000000001'::uuid,
            'user'::text,
            'decision.created'::text,
            'decision_case'::text,
            '71000000-0000-0000-0000-000000000001'::uuid,
            '{}'::jsonb,
            jsonb_build_object('phase', 'identified', 'approval_status', 'draft'),
            jsonb_build_object('note', '创建季节性备货决策以进入排期池'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-12 09:00:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000002'::uuid,
            '71000000-0000-0000-0000-000000000003'::uuid,
            'user'::text,
            'decision.context_snapshot_captured'::text,
            'decision_context_snapshot'::text,
            '75000000-0000-0000-0000-000000000001'::uuid,
            '{}'::jsonb,
            jsonb_build_object('source', 'supplier_scorecard', 'otif', 0.71),
            jsonb_build_object('note', '记录供应商异常快照用于诊断'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 09:01:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000003'::uuid,
            '71000000-0000-0000-0000-000000000006'::uuid,
            'user'::text,
            'decision.recommendation_generated'::text,
            'decision_recommendation'::text,
            '72000000-0000-0000-0000-000000000002'::uuid,
            '{}'::jsonb,
            jsonb_build_object('confidence_score', 0.89, 'title', '建议将 618 零食礼包基线预测上调 18%'),
            jsonb_build_object('note', '生成预测修正建议'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 09:33:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000004'::uuid,
            '71000000-0000-0000-0000-000000000007'::uuid,
            'user'::text,
            'decision.approval_requested'::text,
            'decision_approval'::text,
            '74000000-0000-0000-0000-000000000001'::uuid,
            jsonb_build_object('approval_status', 'draft'),
            jsonb_build_object('approval_status', 'pending'),
            jsonb_build_object('note', '已提交紧急调拨审批'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 09:45:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000005'::uuid,
            '71000000-0000-0000-0000-000000000008'::uuid,
            'user'::text,
            'decision.approval_granted'::text,
            'decision_approval'::text,
            '74000000-0000-0000-0000-000000000002'::uuid,
            jsonb_build_object('approval_status', 'pending'),
            jsonb_build_object('approval_status', 'approved'),
            jsonb_build_object('note', '替补供应商导入获得批准'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 08:50:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000006'::uuid,
            '71000000-0000-0000-0000-000000000009'::uuid,
            'user'::text,
            'decision.execution_started'::text,
            'action_run'::text,
            '77000000-0000-0000-0000-000000000001'::uuid,
            jsonb_build_object('execution_status', 'pending'),
            jsonb_build_object('execution_status', 'running'),
            jsonb_build_object('external_ref', 'ERP-TR-20260413-001'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 10:08:00+08'
        ),
        (
            '78000000-0000-0000-0000-000000000007'::uuid,
            '71000000-0000-0000-0000-000000000010'::uuid,
            'user'::text,
            'decision.execution_completed'::text,
            'action_run'::text,
            '77000000-0000-0000-0000-000000000002'::uuid,
            jsonb_build_object('execution_status', 'running'),
            jsonb_build_object('execution_status', 'completed'),
            jsonb_build_object('external_ref', 'ERP-TR-20260410-017', 'monitor_window', 'D+3'),
            '127.0.0.1'::text,
            'seed_decisions.sql'::text,
            TIMESTAMPTZ '2026-04-13 09:40:00+08'
        )
) AS event (
    id,
    decision_case_id,
    actor_type,
    action,
    target_type,
    target_id,
    old_state,
    new_state,
    metadata,
    ip_address,
    user_agent,
    created_at
)
ON CONFLICT (id) DO NOTHING;
