package handler

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"sync"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/multica-ai/multica/server/internal/events"
	"github.com/multica-ai/multica/server/internal/realtime"
	"github.com/multica-ai/multica/server/internal/service"
	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

var (
	runtimeFixtureOnce sync.Once
	runtimeFixtureErr  error

	runtimeTestHandler     *Handler
	runtimeTestPool        *pgxpool.Pool
	runtimeTestUserID      string
	runtimeTestWorkspaceID string
)

const (
	runtimeTestEmail         = "runtime-handler-test@multica.ai"
	runtimeTestName          = "Runtime Handler Test User"
	runtimeTestWorkspaceSlug = "runtime-handler-tests"
)

func ensureRuntimeHandlerFixture(t *testing.T) {
	t.Helper()

	runtimeFixtureOnce.Do(func() {
		ctx := context.Background()
		dbURL := os.Getenv("DATABASE_URL")
		if dbURL == "" {
			dbURL = "postgres://multica:multica@localhost:22200/multica?sslmode=disable"
		}

		runtimeTestPool, runtimeFixtureErr = pgxpool.New(ctx, dbURL)
		if runtimeFixtureErr != nil {
			return
		}
		if runtimeFixtureErr = runtimeTestPool.Ping(ctx); runtimeFixtureErr != nil {
			return
		}
		if runtimeFixtureErr = cleanupRuntimeHandlerFixture(ctx, runtimeTestPool); runtimeFixtureErr != nil {
			return
		}

		queries := db.New(runtimeTestPool)
		hub := realtime.NewHub()
		go hub.Run()
		bus := events.New()
		emailSvc := service.NewEmailService()
		runtimeTestHandler = New(queries, runtimeTestPool, hub, bus, emailSvc, nil, nil)

		runtimeTestUserID, runtimeTestWorkspaceID, runtimeFixtureErr = setupRuntimeHandlerFixture(ctx, runtimeTestPool)
	})

	if runtimeFixtureErr != nil {
		t.Skipf("runtime fixture unavailable: %v", runtimeFixtureErr)
	}
}

func setupRuntimeHandlerFixture(ctx context.Context, pool *pgxpool.Pool) (string, string, error) {
	if err := cleanupRuntimeHandlerFixture(ctx, pool); err != nil {
		return "", "", err
	}

	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO "user" (name, email)
		VALUES ($1, $2)
		RETURNING id
	`, runtimeTestName, runtimeTestEmail).Scan(&userID); err != nil {
		return "", "", err
	}

	var workspaceID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO workspace (name, slug, description, issue_prefix)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, "Runtime Handler Tests", runtimeTestWorkspaceSlug, "Temporary workspace for runtime handler tests", "RTH").Scan(&workspaceID); err != nil {
		return "", "", err
	}

	if _, err := pool.Exec(ctx, `
		INSERT INTO member (workspace_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, workspaceID, userID); err != nil {
		return "", "", err
	}

	return userID, workspaceID, nil
}

func cleanupRuntimeHandlerFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `DELETE FROM workspace WHERE slug = $1`, runtimeTestWorkspaceSlug); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, runtimeTestEmail); err != nil {
		return err
	}
	return nil
}

func runtimeNewRequest(method, path string, body any) *http.Request {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", runtimeTestUserID)
	req.Header.Set("X-Workspace-ID", runtimeTestWorkspaceID)
	return req
}

func runtimeWithURLParam(req *http.Request, key, value string) *http.Request {
	rctx, _ := req.Context().Value(chi.RouteCtxKey).(*chi.Context)
	if rctx == nil {
		rctx = chi.NewRouteContext()
	}
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}
