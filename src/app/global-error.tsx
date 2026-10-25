"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "sans-serif", padding: 24 }}>
        <h1>managr could not open</h1>
        <button type="button" onClick={reset}>Try again</button>
      </body>
    </html>
  );
}
