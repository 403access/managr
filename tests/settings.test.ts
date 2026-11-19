import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_SETTINGS,
  detailPageKeyForPath,
  resolveDetailSidebarMode,
  parseDetailSidebarOverrides,
  serializeDetailSidebarOverrides,
  isDetailSidebarMode,
} from "@/domain/settings";

describe("detail sidebar settings", () => {
  it("defaults to the inline column", () => {
    expect(DEFAULT_UI_SETTINGS.detailSidebarMode).toBe("inline");
    expect(resolveDetailSidebarMode(DEFAULT_UI_SETTINGS, "customers")).toBe("inline");
  });

  it("lets a page override the global mode", () => {
    const settings = { detailSidebarMode: "overlay" as const, detailSidebarOverrides: { customers: "inline" as const } };
    expect(resolveDetailSidebarMode(settings, "customers")).toBe("inline");
    expect(resolveDetailSidebarMode({ ...settings, detailSidebarOverrides: {} }, "customers")).toBe("overlay");
  });

  it("drops unknown pages and modes from stored JSON", () => {
    expect(parseDetailSidebarOverrides('{"customers":"inline","unknown":"overlay","other":"broken"}')).toEqual({ customers: "inline" });
    expect(parseDetailSidebarOverrides("not json")).toEqual({});
    expect(parseDetailSidebarOverrides("[]")).toEqual({});
  });

  it("round-trips overrides and validates modes", () => {
    const json = serializeDetailSidebarOverrides({ customers: "overlay", time: "inline" });
    expect(parseDetailSidebarOverrides(json)).toEqual({ customers: "overlay", time: "inline" });
    expect(isDetailSidebarMode("inline")).toBe(true);
    expect(isDetailSidebarMode("overlay")).toBe(true);
    expect(isDetailSidebarMode("modal")).toBe(false);
  });

  it("maps routes to their page, including nested routes", () => {
    expect(detailPageKeyForPath("/customers")).toBe("customers");
    expect(detailPageKeyForPath("/time")).toBe("time");
    expect(detailPageKeyForPath("/time/playback")).toBe("time");
    expect(detailPageKeyForPath("/projects")).toBe("projects");
    expect(detailPageKeyForPath("/invoices/3")).toBeNull();
  });
});