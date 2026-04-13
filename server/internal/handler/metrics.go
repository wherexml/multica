package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	db "github.com/multica-ai/multica/server/pkg/db/generated"
)

type MetricSnapshotResponse struct {
	ID             string          `json:"id"`
	DecisionCaseID string          `json:"decision_case_id"`
	SourceType     string          `json:"source_type"`
	SourceRef      string          `json:"source_ref"`
	MetricsJSON    json.RawMessage `json:"metrics_json"`
	CapturedAt     string          `json:"captured_at"`
}

func metricSnapshotToResponse(snapshot db.DecisionContextSnapshot) MetricSnapshotResponse {
	return MetricSnapshotResponse{
		ID:             uuidToString(snapshot.ID),
		DecisionCaseID: uuidToString(snapshot.DecisionCaseID),
		SourceType:     snapshot.Source,
		SourceRef:      snapshot.SourceRef,
		MetricsJSON:    json.RawMessage(snapshot.Metrics),
		CapturedAt:     timestampToString(snapshot.CapturedAt),
	}
}

func (h *Handler) ListSnapshots(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireUserID(w, r); !ok {
		return
	}

	_, pageSize, offset, ok := parseListPage(r, 50)
	if !ok {
		writeError(w, http.StatusBadRequest, "invalid pagination parameters")
		return
	}

	workspaceID := resolveWorkspaceID(r)
	decisionCaseID := r.URL.Query().Get("decision_case_id")
	if decisionCaseID == "" {
		decisionCaseID = r.URL.Query().Get("decision_id")
	}

	source := parseOptionalText(r.URL.Query().Get("source_type"))
	params := db.ListDecisionContextSnapshotsParams{
		WorkspaceID:    parseUUID(workspaceID),
		DecisionCaseID: parseUUID(decisionCaseID),
		Source:         source,
		OffsetCount:    int32(offset),
		LimitCount:     int32(pageSize),
	}

	snapshots, err := h.Queries.ListDecisionContextSnapshots(r.Context(), params)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list snapshots")
		return
	}

	total, err := h.Queries.CountDecisionContextSnapshots(r.Context(), db.CountDecisionContextSnapshotsParams{
		WorkspaceID:    params.WorkspaceID,
		DecisionCaseID: params.DecisionCaseID,
		Source:         params.Source,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list snapshots")
		return
	}

	resp := make([]MetricSnapshotResponse, len(snapshots))
	for i, snapshot := range snapshots {
		resp[i] = metricSnapshotToResponse(snapshot)
	}

	w.Header().Set("X-Total-Count", strconv.FormatInt(total, 10))
	writeJSON(w, http.StatusOK, map[string]any{
		"snapshots": resp,
		"total":     total,
	})
}
