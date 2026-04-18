import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { useWorkspaceId } from "../hooks";
import { sourceKeys } from "./queries";
import type {
  ListSourcesResponse,
  CreateSourceRequest,
  UpdateSourceRequest,
  SourceToolCallRequest,
  UpdateSourceAuthRequest,
} from "../types";
import {
  mergeSourceIntoList,
  removeSourceFromList,
  replaceSourceInList,
} from "./cache";

export function useCreateSource() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: (data: CreateSourceRequest) => api.createSource(data),
    onSuccess: (created) => {
      qc.setQueryData<ListSourcesResponse>(sourceKeys.list(wsId), (old) =>
        mergeSourceIntoList(old, created),
      );
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sourceKeys.all(wsId) });
    },
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & UpdateSourceRequest) =>
      api.updateSource(id, data),
    onSuccess: (updated) => {
      qc.setQueryData<ListSourcesResponse>(sourceKeys.list(wsId), (old) =>
        old ? replaceSourceInList(old, updated) : old,
      );
      qc.setQueryData(sourceKeys.detail(wsId, updated.id), updated);
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, vars.id) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useDeleteSource() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: (sourceId: string) => api.deleteSource(sourceId),
    onMutate: async (sourceId) => {
      await qc.cancelQueries({ queryKey: sourceKeys.list(wsId) });
      const prevList = qc.getQueryData<ListSourcesResponse>(sourceKeys.list(wsId));
      qc.setQueryData<ListSourcesResponse>(sourceKeys.list(wsId), (old) =>
        removeSourceFromList(old, sourceId),
      );
      qc.removeQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      return { prevList };
    },
    onError: (_error, _sourceId, ctx) => {
      if (ctx?.prevList) {
        qc.setQueryData(sourceKeys.list(wsId), ctx.prevList);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useTestSource() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: (sourceId: string) => api.testSource(sourceId),
    onSuccess: (run, sourceId) => {
      qc.setQueryData(sourceKeys.run(wsId, sourceId, run.id), run);
    },
    onSettled: (_data, _error, sourceId) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useRefreshSourceTools() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: (sourceId: string) => api.refreshSourceTools(sourceId),
    onSuccess: (run, sourceId) => {
      qc.setQueryData(sourceKeys.run(wsId, sourceId, run.id), run);
    },
    onSettled: (_data, _error, sourceId) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.tools(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useCallSourceTool() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ sourceId, toolName, data }: { sourceId: string; toolName: string; data: SourceToolCallRequest }) =>
      api.callSourceTool(sourceId, toolName, data),
    onSuccess: (run, { sourceId }) => {
      qc.setQueryData(sourceKeys.run(wsId, sourceId, run.id), run);
    },
    onSettled: (_data, _error, { sourceId }) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useUpdateSourceAuth() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: ({ sourceId, data }: { sourceId: string; data: UpdateSourceAuthRequest }) =>
      api.updateSourceAuth(sourceId, data),
    onSettled: (_data, _error, { sourceId }) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}

export function useClearSourceAuth() {
  const qc = useQueryClient();
  const wsId = useWorkspaceId();

  return useMutation({
    mutationFn: (sourceId: string) => api.clearSourceAuth(sourceId),
    onSettled: (_data, _error, sourceId) => {
      qc.invalidateQueries({ queryKey: sourceKeys.detail(wsId, sourceId) });
      qc.invalidateQueries({ queryKey: sourceKeys.list(wsId) });
    },
  });
}
