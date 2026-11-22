"use client";

import { useSyncExternalStore } from "react";

export type JsonView = "tree" | "raw";

const KEY = "managr-assistant-json";
const listeners = new Set<() => void>();
let current: JsonView | null = null;

function read(): JsonView {
  if (current) return current;
  try {
    current = window.localStorage.getItem(KEY) === "raw" ? "raw" : "tree";
  } catch {
    current = "tree";
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Switches every assistant detail pane between the JSON tree and the raw block. */
export function setJsonView(next: JsonView): void {
  current = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // A private window may refuse storage; the choice then lasts for the mount.
  }
  for (const listener of listeners) listener();
}

export function useJsonView(): JsonView {
  return useSyncExternalStore(subscribe, read, () => "tree");
}