package connector

import (
	"testing"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

func TestMockAdapterSupportsConnectorTypes(t *testing.T) {
	t.Parallel()

	adapter, err := NewAdapter("erp")
	if err != nil {
		t.Fatalf("NewAdapter: %v", err)
	}

	conn := db.Connector{
		Name: "Warehouse ERP",
		Kind: "erp",
	}

	testResult, err := adapter.TestConnection(t.Context(), conn)
	if err != nil {
		t.Fatalf("TestConnection: %v", err)
	}
	if testResult.Status != "healthy" {
		t.Fatalf("TestConnection: expected status healthy, got %q", testResult.Status)
	}
	if testResult.LatencyMs <= 0 {
		t.Fatalf("TestConnection: expected positive latency, got %d", testResult.LatencyMs)
	}

	readResult, err := adapter.Read(t.Context(), conn, "inventory", map[string]any{"sku": "SKU-1"})
	if err != nil {
		t.Fatalf("Read: %v", err)
	}
	if readResult["resource"] != "inventory" {
		t.Fatalf("Read: expected resource inventory, got %#v", readResult["resource"])
	}

	writeResult, err := adapter.Write(t.Context(), conn, "inventory", map[string]any{"sku": "SKU-1"})
	if err != nil {
		t.Fatalf("Write: %v", err)
	}
	if writeResult["status"] != "accepted" {
		t.Fatalf("Write: expected status accepted, got %#v", writeResult["status"])
	}
}

func TestNewAdapterRejectsUnknownType(t *testing.T) {
	t.Parallel()

	if _, err := NewAdapter("unknown"); err == nil {
		t.Fatal("NewAdapter: expected error for unknown type")
	}
}
