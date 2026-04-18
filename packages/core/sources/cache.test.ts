import { describe, expect, it } from "vitest";
import type { ListSourcesResponse, Source } from "../types";
import {
  mergeSourceIntoList,
  removeSourceFromList,
  replaceSourceInList,
} from "./cache";

const baseSource: Source = {
  id: "source-1",
  workspace_id: "ws-1",
  runtime_id: "runtime-1",
  name: "Linear MCP",
  source_type: "mcp",
  connection_status: "untested",
  connection_error: "",
  last_test_message: "",
  last_tested_at: null,
  mcp: {
    transport: "http",
    url: "https://mcp.linear.app",
    auth_type: "none",
  },
  auth_state: {
    auth_type: "none",
    configured: true,
    preview: "",
    updated_at: null,
  },
  tool_summary: null,
  latest_run: null,
  created_at: "2026-04-14T10:00:00Z",
  updated_at: "2026-04-14T10:00:00Z",
};

describe("source list cache helpers", () => {
  it("merges a created source into the list response shape", () => {
    const existing: ListSourcesResponse = {
      sources: [{ ...baseSource, id: "source-2", name: "Docs MCP" }],
      total: 1,
    };

    const result = mergeSourceIntoList(existing, baseSource);

    expect(result).toEqual({
      sources: [baseSource, existing.sources[0]],
      total: 2,
    });
  });

  it("replaces an existing source without changing the response shape", () => {
    const existing: ListSourcesResponse = {
      sources: [baseSource],
      total: 1,
    };

    const result = replaceSourceInList(existing, {
      ...baseSource,
      name: "Linear MCP Updated",
    });

    expect(result).toEqual({
      sources: [{ ...baseSource, name: "Linear MCP Updated" }],
      total: 1,
    });
  });

  it("removes a source from the response shape", () => {
    const existing: ListSourcesResponse = {
      sources: [
        baseSource,
        { ...baseSource, id: "source-2", name: "Docs MCP" },
      ],
      total: 2,
    };

    const result = removeSourceFromList(existing, baseSource.id);

    expect(result).toEqual({
      sources: [{ ...baseSource, id: "source-2", name: "Docs MCP" }],
      total: 1,
    });
  });
});
