export const DETAIL_SIDEBAR_MODES = ["inline", "overlay"] as const;

export type DetailSidebarMode = (typeof DETAIL_SIDEBAR_MODES)[number];

export const DEFAULT_DETAIL_SIDEBAR_MODE: DetailSidebarMode = "inline";

/** Pages that can open a side panel: a detail view or an add form. */
export const DETAIL_PAGES = [
  { key: "customers", path: "/customers" },
  { key: "time", path: "/time" },
  { key: "obligations", path: "/obligations" },
  { key: "company", path: "/company" },
  { key: "ledger", path: "/ledger" },
  { key: "projects", path: "/projects" },
  { key: "documents", path: "/documents" },
  { key: "legal", path: "/legal" },
  { key: "milestones", path: "/milestones" },
] as const;

export type DetailPageKey = (typeof DETAIL_PAGES)[number]["key"];

export const DETAIL_PAGE_KEYS: readonly DetailPageKey[] = DETAIL_PAGES.map((page) => page.key);

export type DetailSidebarOverrides = Partial<Record<DetailPageKey, DetailSidebarMode>>;

export type UiSettings = {
  detailSidebarMode: DetailSidebarMode;
  detailSidebarOverrides: DetailSidebarOverrides;
};

export const DEFAULT_UI_SETTINGS: UiSettings = {
  detailSidebarMode: DEFAULT_DETAIL_SIDEBAR_MODE,
  detailSidebarOverrides: {},
};

export function isDetailSidebarMode(value: string): value is DetailSidebarMode {
  return DETAIL_SIDEBAR_MODES.some((mode) => mode === value);
}

export function isDetailPageKey(value: string): value is DetailPageKey {
  return DETAIL_PAGE_KEYS.some((page) => page === value);
}

/** The page key for a route, following nested routes such as /time/playback. */
export function detailPageKeyForPath(pathname: string): DetailPageKey | null {
  const match = DETAIL_PAGES.find((page) => pathname === page.path || pathname.startsWith(`${page.path}/`));
  return match?.key ?? null;
}

/** A page override wins; otherwise the global setting applies. */
export function resolveDetailSidebarMode(settings: UiSettings, page: DetailPageKey): DetailSidebarMode {
  return settings.detailSidebarOverrides[page] ?? settings.detailSidebarMode;
}

function remember(target: DetailSidebarOverrides, page: string, mode: string): void {
  if (!isDetailPageKey(page) || !isDetailSidebarMode(mode)) return;
  target[page] = mode;
}

/** Reads the JSON stored in the settings row. Unknown pages and modes are dropped. */
export function parseDetailSidebarOverrides(value: string): DetailSidebarOverrides {
  const overrides: DetailSidebarOverrides = {};
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return overrides;
    for (const [page, mode] of Object.entries(parsed)) {
      if (typeof mode === "string") remember(overrides, page, mode);
    }
  } catch {
    // A damaged value falls back to the global setting.
  }
  return overrides;
}

export function serializeDetailSidebarOverrides(overrides: DetailSidebarOverrides): string {
  return JSON.stringify(overrides);
}