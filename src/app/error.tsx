"use client";

import { buttonClass } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-sm text-muted">{error.message || "The desk could not finish that request."}</p>
      <button type="button" className={`${buttonClass()} mt-6`} onClick={reset}>
        Try again
      </button>
    </main>
  );
}
