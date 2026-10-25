"use client";

import { buttonClass } from "./ui";

export function PrintButton() {
  return (
    <button type="button" className={`${buttonClass()} no-print`} onClick={() => window.print()}>
      Print
    </button>
  );
}
