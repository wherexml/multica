DROP TRIGGER IF EXISTS trg_audit_event_immutable ON audit_event;
DROP FUNCTION IF EXISTS enforce_audit_immutability();
DROP TABLE IF EXISTS audit_event;
