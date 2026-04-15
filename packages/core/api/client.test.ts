import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClient } from "./client";

describe("ApiClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("sends requests when crypto.randomUUID is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "token-123",
          user: {
            id: "user-1",
            name: "Steve",
            email: "admin@local",
            avatar_url: null,
            created_at: "2026-04-13T00:00:00Z",
            updated_at: "2026-04-13T00:00:00Z",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.set([1, 2, 3, 4]);
        return bytes;
      },
    });

    const api = new ApiClient("");
    await api.login("admin@local", "admin123");

    expect(fetchMock).toHaveBeenCalledWith(
      "/auth/login",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Request-ID": "01020304",
        }),
      }),
    );
  });
});
