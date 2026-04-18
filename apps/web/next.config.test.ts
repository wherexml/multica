import { describe, expect, it } from "vitest";

import { resolveRemoteApiUrl } from "./next.config";

describe("resolveRemoteApiUrl", () => {
  it("prefers BACKEND_REWRITE_URL when provided", () => {
    expect(
      resolveRemoteApiUrl({
        BACKEND_REWRITE_URL: "http://backend:8080",
        NODE_ENV: "production",
        PORT: "3000",
      }),
    ).toBe("http://backend:8080");
  });

  it("uses localhost:22201 in development without reusing the frontend port", () => {
    expect(
      resolveRemoteApiUrl({
        NODE_ENV: "development",
        PORT: "22202",
      }),
    ).toBe("http://localhost:22201");
  });

  it("defaults to the backend service hostname in production", () => {
    expect(
      resolveRemoteApiUrl({
        NODE_ENV: "production",
        PORT: "3000",
      }),
    ).toBe("http://backend:8080");
  });
});
