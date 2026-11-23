---
slug: /
sidebar_label: Overview
---

# managr

A local desk for German companies, including the UG (haftungsbeschränkt) and an Einzelunternehmen. These pages are the notes in this repository. On the published site they live under `/docs`. The site root is a short description of the desk.

The desk does not file a return, calculate wage tax, or decide social-insurance status.

## Read

- [Architecture](./ARCHITECTURE.md) — how the Next.js app is put together.
- [Domain rules](./DOMAIN.md) — company law, tax, invoices, and the figures the code uses.
- [Roadmap](./ROADMAP.md) — what version 1 includes, and what it refuses to pretend.
- [Assistant and MCP](./MCP-ASSISTANT.md) — the tool layer, the chat panel, and the MCP endpoint.
- [iPhone app](./IPHONE.md) — the native SwiftUI client, build, signing, and install.

## Run the desk

```bash
bun install
bun run dev
```

The first launch creates `data/managr.db` and loads the sample company Atelier Nordlicht UG. Open [http://localhost:3000](http://localhost:3000).

The interface is German by default, with English as the second language. These notes are available in English and German; switch languages in the navigation bar.

## iPhone app

A native SwiftUI client lives in `ios/`. It reads the same view JSON and writes through `POST /api/tools`, which calls the same tool registry and journal as MCP and the assistant. The phone talks to the Next.js server on your Mac over the local Wi-Fi; the Mac keeps the database. See [iPhone app](./IPHONE.md) to build and install it.
