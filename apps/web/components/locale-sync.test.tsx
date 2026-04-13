import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { LocaleSync } from "./locale-sync";

describe("LocaleSync", () => {
  beforeEach(() => {
    document.cookie = "multica-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    document.documentElement.lang = "";
  });

  it("defaults <html lang> to zh-CN when there is no locale cookie", async () => {
    render(<LocaleSync />);

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-CN");
    });
  });

  it("normalizes legacy cookie values before updating <html lang>", async () => {
    document.cookie = "multica-locale=en; path=/";

    render(<LocaleSync />);

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("en-US");
    });
  });

  it("falls back to zh-CN when the cookie contains an unsupported locale", async () => {
    document.cookie = "multica-locale=fr-FR; path=/";

    render(<LocaleSync />);

    await waitFor(() => {
      expect(document.documentElement.lang).toBe("zh-CN");
    });
  });
});
