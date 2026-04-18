import type { ListSourcesResponse, Source } from "../types";

export function mergeSourceIntoList(
  current: ListSourcesResponse | undefined,
  source: Source,
): ListSourcesResponse {
  if (!current) {
    return { sources: [source], total: 1 };
  }

  if (current.sources.some((item) => item.id === source.id)) {
    return replaceSourceInList(current, source);
  }

  return {
    sources: [source, ...current.sources],
    total: current.total + 1,
  };
}

export function replaceSourceInList(
  current: ListSourcesResponse,
  source: Source,
): ListSourcesResponse {
  return {
    ...current,
    sources: current.sources.map((item) => (item.id === source.id ? source : item)),
  };
}

export function removeSourceFromList(
  current: ListSourcesResponse | undefined,
  sourceId: string,
): ListSourcesResponse | undefined {
  if (!current) return current;

  const nextSources = current.sources.filter((item) => item.id !== sourceId);
  return {
    ...current,
    sources: nextSources,
    total: nextSources.length,
  };
}
