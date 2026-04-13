import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "./i18n-provider";

function TestConsumer() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="common-save">{t("common.save")}</div>
      <div data-testid="lexicon-workspace">{t("workspace")}</div>
      <div data-testid="raw-key">{t("unknown.value")}</div>
      <button type="button" onClick={() => setLocale("en-US")}>
        switch
      </button>
    </div>
  );
}

describe("I18nProvider", () => {
  beforeEach(() => {
    document.cookie = "multica-locale=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
  });

  it("defaults to zh-CN and resolves JSON, Lexicon, and raw fallback keys", () => {
    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("zh-CN");
    expect(screen.getByTestId("common-save")).toHaveTextContent("保存");
    expect(screen.getByTestId("lexicon-workspace")).toHaveTextContent("业务空间");
    expect(screen.getByTestId("raw-key")).toHaveTextContent("unknown.value");
  });

  it("normalizes legacy cookie values on first render", () => {
    document.cookie = "multica-locale=en; path=/";

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>,
    );

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(screen.getByTestId("common-save")).toHaveTextContent("Save");
    expect(screen.getByTestId("lexicon-workspace")).toHaveTextContent("Workspace");
  });

  it("persists BCP 47 locale values when the locale changes", async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider>
        <TestConsumer />
      </I18nProvider>,
    );

    await user.click(screen.getByRole("button", { name: "switch" }));

    expect(screen.getByTestId("locale")).toHaveTextContent("en-US");
    expect(document.cookie).toContain("multica-locale=en-US");
  });
});
