package handler

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) ClaimSourceRunByRuntime(w http.ResponseWriter, r *http.Request) {
	runtimeID := chi.URLParam(r, "runtimeId")
	if _, ok := h.requireDaemonRuntimeAccess(w, r, runtimeID); !ok {
		return
	}

	run, err := h.Queries.ClaimNextSourceRunByRuntime(r.Context(), parseUUID(runtimeID))
	if err != nil {
		if isNotFound(err) {
			writeJSON(w, http.StatusOK, map[string]any{"run": nil})
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to claim source run")
		return
	}

	payload, err := h.buildDaemonSourceRunPayload(r.Context(), run)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to build source run payload")
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"run": payload})
}

func (h *Handler) CompleteSourceRunByDaemon(w http.ResponseWriter, r *http.Request) {
	var req ReportSourceRunResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	runID := chi.URLParam(r, "runId")
	run, err := h.Queries.GetSourceRun(r.Context(), parseUUID(runID))
	if err != nil {
		writeError(w, http.StatusNotFound, "source run not found")
		return
	}

	if _, ok := h.requireDaemonRuntimeAccess(w, r, uuidToString(run.RuntimeID)); !ok {
		return
	}

	updated, err := h.completeSourceRunWithPayload(r.Context(), run, req, "completed")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to complete source run")
		return
	}

	writeJSON(w, http.StatusOK, sourceRunToResponse(updated))
}

func (h *Handler) FailSourceRunByDaemon(w http.ResponseWriter, r *http.Request) {
	var req ReportSourceRunResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	runID := chi.URLParam(r, "runId")
	run, err := h.Queries.GetSourceRun(r.Context(), parseUUID(runID))
	if err != nil {
		writeError(w, http.StatusNotFound, "source run not found")
		return
	}

	if _, ok := h.requireDaemonRuntimeAccess(w, r, uuidToString(run.RuntimeID)); !ok {
		return
	}

	if req.Summary == "" && req.ErrorMessage != "" {
		req.Summary = req.ErrorMessage
	}

	updated, err := h.completeSourceRunWithPayload(r.Context(), run, req, "failed")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to fail source run")
		return
	}

	writeJSON(w, http.StatusOK, sourceRunToResponse(updated))
}
