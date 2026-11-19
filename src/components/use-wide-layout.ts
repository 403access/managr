"use client";

import { useEffect, useState } from "react";

/**
 * True once the viewport is at least the app's wide-layout breakpoint.
 * The default matches Tailwind's `lg` (64rem), where a side column still
 * leaves enough room for the content next to it.
 */
export function useWideLayout(minWidth = 1024): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${minWidth}px)`);
    const update = () => setWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [minWidth]);
  return wide;
}