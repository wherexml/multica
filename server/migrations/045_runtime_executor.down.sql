DROP TRIGGER IF EXISTS trg_agent_runtime_executor_defaults ON agent_runtime;
DROP FUNCTION IF EXISTS ensure_runtime_executor_defaults();
DROP INDEX IF EXISTS idx_runtime_executor_kind;
DROP TABLE IF EXISTS runtime_executor;
