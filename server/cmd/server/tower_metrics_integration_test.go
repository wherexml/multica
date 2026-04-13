package main

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

type towerAlertAPIResponse struct {
	ID          string  `json:"id"`
	Type        string  `json:"type"`
	Severity    string  `json:"severity"`
	Title       string  `json:"title"`
	Body        *string `json:"body"`
	IssueID     *string `json:"issue_id"`
	IssueStatus *string `json:"issue_status"`
	CreatedAt   string  `json:"created_at"`
	Domain      string  `json:"domain"`
	RiskLevel   string  `json:"risk_level"`
}

type towerAlertListResponse struct {
	Alerts []towerAlertAPIResponse `json:"alerts"`
	Total  int64                   `json:"total"`
}

type metricSnapshotAPIResponse struct {
	ID             string          `json:"id"`
	DecisionCaseID string          `json:"decision_case_id"`
	SourceType     string          `json:"source_type"`
	SourceRef      string          `json:"source_ref"`
	MetricsJSON    json.RawMessage `json:"metrics_json"`
	CapturedAt     string          `json:"captured_at"`
}

type metricSnapshotListResponse struct {
	Snapshots []metricSnapshotAPIResponse `json:"snapshots"`
	Total     int64                       `json:"total"`
}

type decisionAPIResponse struct {
	ID              string  `json:"id"`
	Domain          string  `json:"domain"`
	DecisionType    string  `json:"decision_type"`
	ObjectType      string  `json:"object_type"`
	ObjectID        string  `json:"object_id"`
	Objective       string  `json:"objective"`
	Constraints     string  `json:"constraints"`
	RiskLevel       string  `json:"risk_level"`
	ExecutionMode   string  `json:"execution_mode"`
	Phase           string  `json:"phase"`
	ApprovalStatus  string  `json:"approval_status"`
	ExecutionStatus string  `json:"execution_status"`
	ProjectID       *string `json:"project_id"`
}

func createIssueViaAPI(t *testing.T, title, status string) map[string]any {
	t.Helper()

	resp := authRequest(t, "POST", "/api/issues", map[string]any{
		"title":    title,
		"status":   status,
		"priority": "high",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("CreateIssue: expected 201, got %d", resp.StatusCode)
	}

	var issue map[string]any
	readJSON(t, resp, &issue)
	return issue
}

func createDecisionViaAPI(t *testing.T, title string) decisionAPIResponse {
	t.Helper()

	resp := authRequest(t, "POST", "/api/decisions", map[string]any{
		"title":          title,
		"priority":       "high",
		"domain":         "metrics_test",
		"decision_type":  "snapshot_refresh",
		"object_type":    "issue",
		"object_id":      title,
		"objective":      "Track metrics snapshots",
		"constraints":    "None",
		"risk_level":     "medium",
		"execution_mode": "manual",
	})
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d", resp.StatusCode)
	}

	var decision decisionAPIResponse
	readJSON(t, resp, &decision)
	return decision
}

func createInboxAlertRow(t *testing.T, issueID, alertType, severity, title, body string, details map[string]any) string {
	t.Helper()

	payload, err := json.Marshal(details)
	if err != nil {
		t.Fatalf("marshal alert details: %v", err)
	}

	var alertID string
	err = testPool.QueryRow(context.Background(), `
		INSERT INTO inbox_item (
			workspace_id, recipient_type, recipient_id,
			type, severity, issue_id, title, body, details
		) VALUES ($1, 'member', $2, $3, $4, $5, $6, $7, $8)
		RETURNING id
	`, testWorkspaceID, testUserID, alertType, severity, issueID, title, body, payload).Scan(&alertID)
	if err != nil {
		t.Fatalf("create inbox alert: %v", err)
	}

	return alertID
}

func createSnapshotRow(t *testing.T, decisionCaseID, sourceType, sourceRef string, metrics map[string]any, capturedAt time.Time) string {
	t.Helper()

	payload, err := json.Marshal(metrics)
	if err != nil {
		t.Fatalf("marshal snapshot metrics: %v", err)
	}

	var snapshotID string
	err = testPool.QueryRow(context.Background(), `
		INSERT INTO decision_context_snapshot (
			decision_case_id, workspace_id, source, source_ref, metrics, captured_at
		) VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, decisionCaseID, testWorkspaceID, sourceType, sourceRef, payload, capturedAt).Scan(&snapshotID)
	if err != nil {
		t.Fatalf("create decision snapshot: %v", err)
	}

	return snapshotID
}

func TestTowerAlertsThroughRouter(t *testing.T) {
	domain := "tower-alert-test"

	issue1 := createIssueViaAPI(t, "Tower alert stockout issue", "blocked")
	issue2 := createIssueViaAPI(t, "Tower alert finance issue", "in_review")
	issue3 := createIssueViaAPI(t, "Tower alert ignored issue", "todo")

	createInboxAlertRow(t, issue1["id"].(string), "stockout_risk", "action_required", "Coverage below threshold", "Coverage dropped under two days", map[string]any{
		"domain":      domain,
		"risk_level":  "critical",
		"object_type": "sku",
		"object_id":   "SKU-TOWER-1",
	})
	createInboxAlertRow(t, issue2["id"].(string), "forecast_error", "attention", "Forecast deviation rising", "Variance crossed alert band", map[string]any{
		"domain":      domain,
		"risk_level":  "high",
		"object_type": "forecast",
		"object_id":   "FC-TOWER-2",
	})
	createInboxAlertRow(t, issue3["id"].(string), "informational", "low", "Low severity noise", "This should not appear in tower alerts", map[string]any{
		"domain":      domain,
		"risk_level":  "low",
		"object_type": "note",
		"object_id":   "NOISE-3",
	})

	resp := authRequest(t, "GET", "/api/tower/alerts?domain="+domain+"&page=1&page_size=1", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ListAlerts: expected 200, got %d", resp.StatusCode)
	}

	var page towerAlertListResponse
	readJSON(t, resp, &page)
	if page.Total != 2 {
		t.Fatalf("ListAlerts: expected total 2, got %d", page.Total)
	}
	if len(page.Alerts) != 1 {
		t.Fatalf("ListAlerts: expected 1 alert on first page, got %d", len(page.Alerts))
	}
	if page.Alerts[0].Domain != domain {
		t.Fatalf("ListAlerts: expected domain %q, got %q", domain, page.Alerts[0].Domain)
	}

	resp = authRequest(t, "GET", "/api/tower/alerts?domain="+domain+"&severity=attention&page=1&page_size=10", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ListAlerts severity filter: expected 200, got %d", resp.StatusCode)
	}

	var severityFiltered towerAlertListResponse
	readJSON(t, resp, &severityFiltered)
	if severityFiltered.Total != 1 || len(severityFiltered.Alerts) != 1 {
		t.Fatalf("ListAlerts severity filter: expected exactly 1 alert, got total=%d len=%d", severityFiltered.Total, len(severityFiltered.Alerts))
	}
	if severityFiltered.Alerts[0].Severity != "attention" {
		t.Fatalf("ListAlerts severity filter: expected severity %q, got %q", "attention", severityFiltered.Alerts[0].Severity)
	}
	if severityFiltered.Alerts[0].IssueStatus == nil || *severityFiltered.Alerts[0].IssueStatus != "in_review" {
		t.Fatalf("ListAlerts severity filter: expected issue status %q", "in_review")
	}

	resp = authRequest(t, "GET", "/api/tower/alerts?domain="+domain+"&risk_level=critical&page=1&page_size=10", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ListAlerts risk filter: expected 200, got %d", resp.StatusCode)
	}

	var riskFiltered towerAlertListResponse
	readJSON(t, resp, &riskFiltered)
	if riskFiltered.Total != 1 || len(riskFiltered.Alerts) != 1 {
		t.Fatalf("ListAlerts risk filter: expected exactly 1 alert, got total=%d len=%d", riskFiltered.Total, len(riskFiltered.Alerts))
	}
	if riskFiltered.Alerts[0].RiskLevel != "critical" {
		t.Fatalf("ListAlerts risk filter: expected risk level %q, got %q", "critical", riskFiltered.Alerts[0].RiskLevel)
	}
}

func TestTowerAlertToDecisionThroughRouter(t *testing.T) {
	issue := createIssueViaAPI(t, "Tower convert issue", "blocked")
	alertID := createInboxAlertRow(t, issue["id"].(string), "stockout_risk", "action_required", "Convert this alert", "Coverage is trending below target", map[string]any{
		"domain":      "tower-convert",
		"object_type": "sku",
		"object_id":   "SKU-CONVERT-1",
		"metrics": map[string]any{
			"coverage_days": 1.4,
			"forecast_7d":   3200,
		},
	})

	wsURL := "ws" + strings.TrimPrefix(testServer.URL, "http") + "/ws?token=" + testToken + "&workspace_id=" + testWorkspaceID
	conn, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("WebSocket connection failed: %v", err)
	}
	defer conn.Close()

	time.Sleep(100 * time.Millisecond)

	resp := authRequest(t, "POST", "/api/tower/alerts/"+alertID+"/decision", nil)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("AlertToDecision: expected 201, got %d", resp.StatusCode)
	}

	var created decisionAPIResponse
	readJSON(t, resp, &created)
	if created.ID != issue["id"].(string) {
		t.Fatalf("AlertToDecision: expected decision id %q, got %q", issue["id"].(string), created.ID)
	}
	if created.Domain != "tower-convert" {
		t.Fatalf("AlertToDecision: expected domain %q, got %q", "tower-convert", created.Domain)
	}
	if created.DecisionType != "stockout_risk" {
		t.Fatalf("AlertToDecision: expected decision_type %q, got %q", "stockout_risk", created.DecisionType)
	}
	if created.ObjectType != "sku" || created.ObjectID != "SKU-CONVERT-1" {
		t.Fatalf("AlertToDecision: expected object sku/SKU-CONVERT-1, got %q/%q", created.ObjectType, created.ObjectID)
	}
	if created.Phase != "identified" {
		t.Fatalf("AlertToDecision: expected phase %q, got %q", "identified", created.Phase)
	}
	if created.RiskLevel != "high" {
		t.Fatalf("AlertToDecision: expected risk level %q, got %q", "high", created.RiskLevel)
	}

	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("AlertToDecision websocket read error: %v", err)
	}

	var wsMsg map[string]any
	if err := json.Unmarshal(msg, &wsMsg); err != nil {
		t.Fatalf("parse websocket message: %v", err)
	}
	if wsMsg["type"] != "decision:created" {
		t.Fatalf("expected websocket type %q, got %q", "decision:created", wsMsg["type"])
	}

	var snapshotCount int
	err = testPool.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM decision_context_snapshot WHERE decision_case_id = $1
	`, created.ID).Scan(&snapshotCount)
	if err != nil {
		t.Fatalf("count decision snapshots: %v", err)
	}
	if snapshotCount != 1 {
		t.Fatalf("expected 1 decision snapshot, got %d", snapshotCount)
	}

	var sourceType, sourceRef string
	err = testPool.QueryRow(context.Background(), `
		SELECT source, source_ref FROM decision_context_snapshot WHERE decision_case_id = $1
	`, created.ID).Scan(&sourceType, &sourceRef)
	if err != nil {
		t.Fatalf("load created snapshot: %v", err)
	}
	if sourceType != "tower_alert" || sourceRef != alertID {
		t.Fatalf("expected snapshot source %q/%q, got %q/%q", "tower_alert", alertID, sourceType, sourceRef)
	}

	resp = authRequest(t, "POST", "/api/tower/alerts/"+alertID+"/decision", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("AlertToDecision idempotent call: expected 200, got %d", resp.StatusCode)
	}

	var existing decisionAPIResponse
	readJSON(t, resp, &existing)
	if existing.ID != created.ID {
		t.Fatalf("AlertToDecision idempotent call: expected decision id %q, got %q", created.ID, existing.ID)
	}

	err = testPool.QueryRow(context.Background(), `
		SELECT COUNT(*) FROM decision_context_snapshot WHERE decision_case_id = $1
	`, created.ID).Scan(&snapshotCount)
	if err != nil {
		t.Fatalf("count decision snapshots after idempotent call: %v", err)
	}
	if snapshotCount != 1 {
		t.Fatalf("expected snapshot count to remain 1, got %d", snapshotCount)
	}
}

func TestMetricSnapshotsThroughRouter(t *testing.T) {
	decision := createDecisionViaAPI(t, "Metrics snapshot decision")
	otherDecision := createDecisionViaAPI(t, "Metrics snapshot decision other")

	firstCapturedAt := time.Date(2026, 4, 13, 9, 0, 0, 0, time.UTC)
	secondCapturedAt := time.Date(2026, 4, 13, 10, 0, 0, 0, time.UTC)

	createSnapshotRow(t, decision.ID, "tower_alert", "tower-alert-1", map[string]any{
		"coverage_days": 2.3,
		"service_level": 0.91,
	}, firstCapturedAt)
	createSnapshotRow(t, decision.ID, "erp", "erp-snapshot-2", map[string]any{
		"coverage_days": 1.8,
		"service_level": 0.88,
	}, secondCapturedAt)
	createSnapshotRow(t, otherDecision.ID, "erp", "erp-snapshot-other", map[string]any{
		"coverage_days": 9.1,
	}, secondCapturedAt.Add(time.Hour))

	resp := authRequest(t, "GET", "/api/metrics/snapshots?decision_case_id="+decision.ID+"&page=1&page_size=1", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("ListSnapshots: expected 200, got %d", resp.StatusCode)
	}

	var result metricSnapshotListResponse
	readJSON(t, resp, &result)
	if result.Total != 2 {
		t.Fatalf("ListSnapshots: expected total 2, got %d", result.Total)
	}
	if len(result.Snapshots) != 1 {
		t.Fatalf("ListSnapshots: expected 1 snapshot on first page, got %d", len(result.Snapshots))
	}
	if result.Snapshots[0].DecisionCaseID != decision.ID {
		t.Fatalf("ListSnapshots: expected decision_case_id %q, got %q", decision.ID, result.Snapshots[0].DecisionCaseID)
	}
	if result.Snapshots[0].SourceType != "erp" || result.Snapshots[0].SourceRef != "erp-snapshot-2" {
		t.Fatalf("ListSnapshots: expected latest snapshot source %q/%q, got %q/%q", "erp", "erp-snapshot-2", result.Snapshots[0].SourceType, result.Snapshots[0].SourceRef)
	}

	var metrics map[string]any
	if err := json.Unmarshal(result.Snapshots[0].MetricsJSON, &metrics); err != nil {
		t.Fatalf("ListSnapshots: decode metrics json: %v", err)
	}
	if metrics["coverage_days"] != float64(1.8) {
		t.Fatalf("ListSnapshots: expected coverage_days %v, got %v", 1.8, metrics["coverage_days"])
	}
}
