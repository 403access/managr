"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  DEFAULT_UI_SETTINGS,
  resolveDetailSidebarMode,
  type DetailPageKey,
  type DetailSidebarMode,
  type UiSettings,
} from "@/domain/settings";

const SettingsContext = createContext<UiSettings>(DEFAULT_UI_SETTINGS);

export function SettingsProvider({ settings, children }: { settings?: UiSettings; children: ReactNode }) {
  return <SettingsContext.Provider value={settings ?? DEFAULT_UI_SETTINGS}>{children}</SettingsContext.Provider>;
}

export function useUiSettings(): UiSettings {
  return useContext(SettingsContext);
}

/** The mode for one page: its override when set, otherwise the global default. */
export function useDetailSidebarMode(page: DetailPageKey): DetailSidebarMode {
  return resolveDetailSidebarMode(useContext(SettingsContext), page);
}