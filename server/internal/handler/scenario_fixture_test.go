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
	scenarioFixtureOnce sync.Once
	scenarioFixtureErr  error

	scenarioHandler     *Handler
	scenarioPool        *pgxpool.Pool
	scenarioUserID      string
	scenarioWorkspaceID string
)

const (
	scenarioFixtureEmail = "scenario-handler-test@multica.ai"
	scenarioFixtureName  = "Scenario Handler Test User"
	scenarioFixtureSlug  = "scenario-handler-tests"
)

func ensureScenarioTestFixture(t *testing.T) {
	t.Helper()

	scenarioFixtureOnce.Do(func() {
		ctx := context.Background()

		dbURL := os.Getenv("DATABASE_URL")
		if dbURL == "" {
			dbURL = "postgres://multica:multica@localhost:22200/multica?sslmode=disable"
		}

		scenarioPool, scenarioFixtureErr = pgxpool.New(ctx, dbURL)
		if scenarioFixtureErr != nil {
			return
		}
		if scenarioFixtureErr = scenarioPool.Ping(ctx); scenarioFixtureErr != nil {
			return
		}
		if scenarioFixtureErr = cleanupScenarioTestFixture(ctx, scenarioPool); scenarioFixtureErr != nil {
			return
		}

		queries := db.New(scenarioPool)
		hub := realtime.NewHub()
		go hub.Run()
		bus := events.New()
		emailSvc := service.NewEmailService()

		scenarioHandler = &Handler{
			Queries:      queries,
			DB:           scenarioPool,
			TxStarter:    scenarioPool,
			Hub:          hub,
			Bus:          bus,
			TaskService:  service.NewTaskService(queries, hub, bus),
			EmailService: emailSvc,
			PingStore:    NewPingStore(),
			UpdateStore:  NewUpdateStore(),
		}

		scenarioUserID, scenarioWorkspaceID, scenarioFixtureErr = setupScenarioTestFixture(ctx, scenarioPool)
	})

	if scenarioFixtureErr != nil {
		t.Skipf("scenario fixture unavailable: %v", scenarioFixtureErr)
	}
}

func setupScenarioTestFixture(ctx context.Context, pool *pgxpool.Pool) (string, string, error) {
	var userID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO "user" (name, email)
		VALUES ($1, $2)
		RETURNING id
	`, scenarioFixtureName, scenarioFixtureEmail).Scan(&userID); err != nil {
		return "", "", err
	}

	var workspaceID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO workspace (name, slug, description, issue_prefix)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, "Scenario Handler Tests", scenarioFixtureSlug, "Temporary workspace for scenario handler tests", "SCH").Scan(&workspaceID); err != nil {
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

func cleanupScenarioTestFixture(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `DELETE FROM workspace WHERE slug = $1`, scenarioFixtureSlug); err != nil {
		return err
	}
	if _, err := pool.Exec(ctx, `DELETE FROM "user" WHERE email = $1`, scenarioFixtureEmail); err != nil {
		return err
	}
	return nil
}

func scenarioNewRequest(method, path string, body any) *http.Request {
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}

	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-User-ID", scenarioUserID)
	req.Header.Set("X-Workspace-ID", scenarioWorkspaceID)
	return req
}

func withScenarioURLParam(req *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
}

func createScenarioDecisionForTest(t *testing.T, body map[string]any) DecisionResponse {
	t.Helper()
	ensureScenarioTestFixture(t)

	w := httptest.NewRecorder()
	req := scenarioNewRequest("POST", "/api/decisions", body)
	scenarioHandler.CreateDecision(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("CreateDecision: expected 201, got %d: %s", w.Code, w.Body.String())
	}

	var created DecisionResponse
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("CreateDecision: decode response: %v", err)
	}
	return created
}
