# Multica 改造文档索引（README_refactor_docs.md）

## 文件列表

1. `todo.md`
   - Harness-Friendly 的任务清单
   - 含优先级、依赖、验收、验证、回滚

2. `design.md`
   - 基于当前仓库 UI 的设计规范
   - 页面壳、侧边栏、布局模式、组件约束、i18n 兼容要求

3. `frontend.md`
   - 前端文件级改造方案
   - 路由、组件拆分、i18n、状态管理、测试

4. `backend.md`
   - 后端模块化改造方案
   - 路由、service、状态机、连接器、动作执行

5. `api_contract.md`
   - 新增供应链语义层 API 合约
   - 请求/响应、错误码、枚举、前置条件

6. `database.md`
   - 数据模型与迁移方案
   - 新表、DDL、索引、关系、回填策略

7. `deployment.md`
   - 私有化部署、运行治理、配置与回滚方案

## 推荐阅读顺序

1. `README_refactor_docs.md`
2. `design.md`
3. `todo.md`
4. `frontend.md`
5. `backend.md`
6. `api_contract.md`
7. `database.md`
8. `deployment.md`

## 推荐执行顺序

1. 先读 `design.md` 对齐当前 UI 设计边界
2. 再按 `todo.md` 的 P0 任务推进
3. 同步使用 `frontend.md` / `backend.md` / `database.md` 落代码
4. API 以 `api_contract.md` 为准
5. 最后用 `deployment.md` 做环境收口
