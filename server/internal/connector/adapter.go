package connector

import (
	"context"
	"fmt"
	"time"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type ConnectionTestResult struct {
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message"`
}

type ConnectorAdapter interface {
	TestConnection(ctx context.Context, connector db.Connector) (ConnectionTestResult, error)
	Read(ctx context.Context, connector db.Connector, resource string, params map[string]any) (map[string]any, error)
	Write(ctx context.Context, connector db.Connector, resource string, payload map[string]any) (map[string]any, error)
}

type AdapterFactory func() ConnectorAdapter

var adapterFactories = map[string]AdapterFactory{
	"erp": func() ConnectorAdapter { return MockAdapter{} },
	"oms": func() ConnectorAdapter { return MockAdapter{} },
	"wms": func() ConnectorAdapter { return MockAdapter{} },
	"dwh": func() ConnectorAdapter { return MockAdapter{} },
	"bi":  func() ConnectorAdapter { return MockAdapter{} },
}

func NewAdapter(connectorType string) (ConnectorAdapter, error) {
	factory, ok := adapterFactories[connectorType]
	if !ok {
		return nil, fmt.Errorf("unsupported connector type: %s", connectorType)
	}
	return factory(), nil
}

type MockAdapter struct{}

func (MockAdapter) TestConnection(ctx context.Context, connector db.Connector) (ConnectionTestResult, error) {
	start := time.Now()
	timer := time.NewTimer(25 * time.Millisecond)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		return ConnectionTestResult{}, ctx.Err()
	case <-timer.C:
	}

	latencyMs := time.Since(start).Milliseconds()
	if latencyMs < 1 {
		latencyMs = 1
	}

	return ConnectionTestResult{
		Status:    "healthy",
		LatencyMs: latencyMs,
		Message:   fmt.Sprintf("mock connector %s is reachable", connector.Name),
	}, nil
}

func (MockAdapter) Read(_ context.Context, connector db.Connector, resource string, params map[string]any) (map[string]any, error) {
	return map[string]any{
		"connector_name": connector.Name,
		"connector_type": connector.Kind,
		"resource":       resource,
		"params":         params,
		"records": []map[string]any{
			{
				"id":     "mock-record-1",
				"status": "ok",
			},
		},
	}, nil
}

func (MockAdapter) Write(_ context.Context, connector db.Connector, resource string, payload map[string]any) (map[string]any, error) {
	return map[string]any{
		"connector_name": connector.Name,
		"connector_type": connector.Kind,
		"resource":       resource,
		"payload":        payload,
		"status":         "accepted",
	}, nil
}
