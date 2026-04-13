package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func createConnectorForTest(t *testing.T, body map[string]any) ConnectorResponse {
	t.Helper()

	w := httptest.NewRecorder()
	req := newRequest("POST", "/api/connectors", body)
	testHandler.CreateConnector(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateConnector: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created ConnectorResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("CreateConnector: decode response: %v", err)
	}
	return created
}

func TestConnectorCRUDAndHealthCheck(t *testing.T) {
	name := strings.ReplaceAll(t.Name(), "/", "-")
	created := createConnectorForTest(t, map[string]any{
		"name":            name,
		"connector_type":  "erp",
		"base_url":        "https://erp.example.com",
		"capabilities":    []string{"read"},
		"auth_config":     map[string]any{"token": "secret"},
		"allowed_actions": []string{"sync_inventory"},
	})

	if created.Name != name {
		t.Fatalf("CreateConnector: expected name %q, got %q", name, created.Name)
	}
	if created.ConnectorType != "erp" {
		t.Fatalf("CreateConnector: expected connector_type %q, got %q", "erp", created.ConnectorType)
	}
	if len(created.Capabilities) != 1 || created.Capabilities[0] != "read" {
		t.Fatalf("CreateConnector: expected capabilities [read], got %#v", created.Capabilities)
	}
	if created.HealthStatus != "unknown" {
		t.Fatalf("CreateConnector: expected health_status %q, got %q", "unknown", created.HealthStatus)
	}

	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/connectors/"+created.ID, nil)
	req = withURLParam(req, "connectorId", created.ID)
	testHandler.GetConnector(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConnector: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var fetched ConnectorResponse
	if err := json.NewDecoder(w.Body).Decode(&fetched); err != nil {
		t.Fatalf("GetConnector: decode response: %v", err)
	}
	if fetched.ID != created.ID {
		t.Fatalf("GetConnector: expected id %q, got %q", created.ID, fetched.ID)
	}

	w = httptest.NewRecorder()
	req = newRequest("PATCH", "/api/connectors/"+created.ID, map[string]any{
		"name":            name + "-updated",
		"connector_type":  "oms",
		"base_url":        "https://oms.example.com",
		"capabilities":    []string{"write"},
		"auth_config":     map[string]any{"api_key": "updated"},
		"allowed_actions": []string{"push_orders"},
	})
	req = withURLParam(req, "connectorId", created.ID)
	testHandler.UpdateConnector(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("UpdateConnector: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var updated ConnectorResponse
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("UpdateConnector: decode response: %v", err)
	}
	if updated.Name != name+"-updated" {
		t.Fatalf("UpdateConnector: expected updated name, got %q", updated.Name)
	}
	if updated.ConnectorType != "oms" {
		t.Fatalf("UpdateConnector: expected connector_type %q, got %q", "oms", updated.ConnectorType)
	}
	if len(updated.Capabilities) != 1 || updated.Capabilities[0] != "write" {
		t.Fatalf("UpdateConnector: expected capabilities [write], got %#v", updated.Capabilities)
	}

	w = httptest.NewRecorder()
	req = newRequest("POST", "/api/connectors/"+created.ID+"/test", nil)
	req = withURLParam(req, "connectorId", created.ID)
	testHandler.TestConnector(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("TestConnector: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var testResult ConnectorTestResponse
	if err := json.NewDecoder(w.Body).Decode(&testResult); err != nil {
		t.Fatalf("TestConnector: decode response: %v", err)
	}
	if testResult.Status != "healthy" {
		t.Fatalf("TestConnector: expected status %q, got %q", "healthy", testResult.Status)
	}
	if testResult.LatencyMs <= 0 {
		t.Fatalf("TestConnector: expected positive latency, got %d", testResult.LatencyMs)
	}

	w = httptest.NewRecorder()
	req = newRequest("GET", "/api/connectors/"+created.ID, nil)
	req = withURLParam(req, "connectorId", created.ID)
	testHandler.GetConnector(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("GetConnector after test: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var healthy ConnectorResponse
	if err := json.NewDecoder(w.Body).Decode(&healthy); err != nil {
		t.Fatalf("GetConnector after test: decode response: %v", err)
	}
	if healthy.HealthStatus != "healthy" {
		t.Fatalf("GetConnector after test: expected health_status %q, got %q", "healthy", healthy.HealthStatus)
	}
	if healthy.LastTestedAt == nil || *healthy.LastTestedAt == "" {
		t.Fatal("GetConnector after test: expected last_tested_at to be set")
	}
}

func TestListConnectorsFiltersByType(t *testing.T) {
	erp := createConnectorForTest(t, map[string]any{
		"name":           strings.ReplaceAll(t.Name(), "/", "-") + "-erp",
		"connector_type": "erp",
		"capabilities":   []string{"read"},
	})
	oms := createConnectorForTest(t, map[string]any{
		"name":           strings.ReplaceAll(t.Name(), "/", "-") + "-oms",
		"connector_type": "oms",
		"capabilities":   []string{"write"},
	})

	w := httptest.NewRecorder()
	req := newRequest("GET", "/api/connectors?connector_type=oms", nil)
	testHandler.ListConnectors(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("ListConnectors: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Connectors []ConnectorResponse `json:"connectors"`
		Total      int                 `json:"total"`
	}
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("ListConnectors: decode response: %v", err)
	}
	if resp.Total < 1 {
		t.Fatalf("ListConnectors: expected total >= 1, got %d", resp.Total)
	}

	foundOMS := false
	for _, connector := range resp.Connectors {
		if connector.ID == oms.ID {
			foundOMS = true
			if connector.ConnectorType != "oms" {
				t.Fatalf("ListConnectors: expected filtered connector_type %q, got %q", "oms", connector.ConnectorType)
			}
		}
		if connector.ID == erp.ID {
			t.Fatalf("ListConnectors: unexpected connector %q in oms results", erp.ID)
		}
	}
	if !foundOMS {
		t.Fatalf("ListConnectors: expected to find connector %q", oms.ID)
	}
}
