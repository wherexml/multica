"use client";

import { useCallback, useState } from "react";
import { DatabaseZap } from "lucide-react";
import { useDefaultLayout } from "react-resizable-panels";
import { useQuery } from "@tanstack/react-query";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@multica/ui/components/ui/resizable";
import { Skeleton } from "@multica/ui/components/ui/skeleton";
import { useAuthStore } from "@multica/core/auth";
import { useWorkspaceId } from "@multica/core/hooks";
import { runtimeListOptions } from "@multica/core/runtimes/queries";
import { useCreateSource, useTestSource, useUpdateSource } from "@multica/core/sources/mutations";
import { sourceDetailOptions, sourceListOptions } from "@multica/core/sources/queries";
import type { CreateSourceRequest, Source, UpdateSourceRequest } from "@multica/core/types";
import { SourceList } from "./source-list";
import { SourceDetail } from "./source-detail";
import { CreateSourceDialog } from "./create-source-dialog";

export default function SourcesPage() {
  const isLoading = useAuthStore((state) => state.isLoading);
  const wsId = useWorkspaceId();
  const [selectedId, setSelectedId] = useState("");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingSource, setEditingSource] = useState<Source | null>(null);

  const { data: sourceList, isLoading: sourcesLoading } = useQuery(sourceListOptions(wsId));
  const { data: runtimes = [], isLoading: runtimesLoading } = useQuery(runtimeListOptions(wsId));
  const sources = sourceList?.sources ?? [];
  const effectiveSelectedId = selectedId && sources.some((source) => source.id === selectedId)
    ? selectedId
    : sources[0]?.id ?? "";
  const { data: selectedSourceDetail } = useQuery({
    ...sourceDetailOptions(wsId, effectiveSelectedId),
    enabled: !!effectiveSelectedId,
  });
  const createMutation = useCreateSource();
  const updateMutation = useUpdateSource();
  const testMutation = useTestSource();

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "multica_sources_layout",
  });

  const selectedSource = selectedSourceDetail ?? sources.find((source) => source.id === effectiveSelectedId) ?? null;

  const handleCreate = useCallback(async (data: CreateSourceRequest | UpdateSourceRequest) => {
    if ("runtime_id" in data && !editingSource) {
      const created = await createMutation.mutateAsync(data as CreateSourceRequest);
      setSelectedId(created.id);
      await testMutation.mutateAsync(created.id);
      return;
    }

    if (!editingSource) {
      throw new Error("缺少要更新的数据源");
    }

    await updateMutation.mutateAsync({
      id: editingSource.id,
      ...(data as UpdateSourceRequest),
    });
    await testMutation.mutateAsync(editingSource.id);
  }, [createMutation, editingSource, testMutation, updateMutation]);

  const openCreate = () => {
    setEditingSource(null);
    setDialogMode("create");
  };

  const openEdit = (source: Source) => {
    setEditingSource(source);
    setDialogMode("edit");
  };

  const closeDialog = () => {
    setDialogMode(null);
    setEditingSource(null);
  };

  const loading = isLoading || sourcesLoading || runtimesLoading;

  if (loading) {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="w-80 border-r">
          <div className="flex h-12 items-center justify-between border-b px-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-14 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 space-y-6 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-5 w-40" />
          </div>
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ResizablePanelGroup
        orientation="horizontal"
        className="flex-1 min-h-0"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
      >
        <ResizablePanel
          id="sources-list"
          defaultSize={320}
          minSize={260}
          maxSize={420}
          groupResizeBehavior="preserve-pixel-size"
        >
          <SourceList
            sources={sources}
            runtimes={runtimes}
            selectedId={effectiveSelectedId}
            onSelect={setSelectedId}
            onCreate={openCreate}
          />
        </ResizablePanel>

        <ResizableHandle />

        <ResizablePanel id="sources-detail" minSize="50%">
          {selectedSource ? (
            <SourceDetail
              key={selectedSource.id}
              source={selectedSource}
              runtimes={runtimes}
              onEdit={openEdit}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
              <DatabaseZap className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm">选择一个数据源查看详情</p>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      {dialogMode && (
        <CreateSourceDialog
          runtimes={runtimes}
          source={dialogMode === "edit" ? editingSource : null}
          onClose={closeDialog}
          onSubmit={handleCreate}
        />
      )}
    </>
  );
}
