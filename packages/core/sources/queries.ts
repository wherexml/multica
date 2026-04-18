import { queryOptions } from "@tanstack/react-query";
import { api } from "../api";
import type { ListSourcesResponse, Source, SourceRun } from "../types";

export const sourceKeys = {
  all: (wsId: string) => ["sources", wsId] as const,
  list: (wsId: string) => [...sourceKeys.all(wsId), "list"] as const,
  detail: (wsId: string, id: string) => [...sourceKeys.all(wsId), "detail", id] as const,
  tools: (wsId: string, id: string) => [...sourceKeys.detail(wsId, id), "tools"] as const,
  run: (wsId: string, id: string, runId: string) => [...sourceKeys.detail(wsId, id), "run", runId] as const,
};

function shouldPollRun(run?: SourceRun | null) {
  return run?.status === "pending" || run?.status === "running";
}

function listShouldPoll(data?: ListSourcesResponse) {
  return !!data?.sources.some((source) => shouldPollRun(source.latest_run));
}

export function sourceListOptions(wsId: string) {
  return queryOptions({
    queryKey: sourceKeys.list(wsId),
    queryFn: () => api.listSources({ workspace_id: wsId }),
    refetchInterval: (query) => listShouldPoll(query.state.data as ListSourcesResponse | undefined) ? 2000 : false,
  });
}

export function sourceDetailOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: sourceKeys.detail(wsId, id),
    queryFn: () => api.getSource(id),
    refetchInterval: (query) => shouldPollRun((query.state.data as Source | undefined)?.latest_run) ? 2000 : false,
  });
}

export function sourceToolsOptions(wsId: string, id: string) {
  return queryOptions({
    queryKey: sourceKeys.tools(wsId, id),
    queryFn: () => api.listSourceTools(id),
  });
}

export function sourceRunOptions(wsId: string, sourceId: string, runId: string) {
  return queryOptions({
    queryKey: sourceKeys.run(wsId, sourceId, runId),
    queryFn: () => api.getSourceRun(sourceId, runId),
    refetchInterval: (query) => shouldPollRun(query.state.data as SourceRun | undefined) ? 2000 : false,
  });
}
