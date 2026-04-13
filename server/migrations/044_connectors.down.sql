ALTER TABLE IF EXISTS action_run
DROP CONSTRAINT IF EXISTS action_run_connector_id_fkey;

DROP TABLE IF EXISTS connector;
