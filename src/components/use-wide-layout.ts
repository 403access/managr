"use client";

import { useEffect, useState } from "react";

/** True once the viewport is at least the app's wide-layout breakpoint. */
export function useWideLayout(minWidth = 1280): boolean {
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