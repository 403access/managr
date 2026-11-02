# managr

A local desk for one German UG (haftungsbeschränkt): company records, obligations, invoices, a double-entry ledger, people, social-insurance estimates, time, documents, and legal notes.

It is a planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/managr.db` and loads the sample company Atelier Nordlicht UG. Delete that file to start over. Uploaded files live in `data/uploads`.

```bash
bun run test
bun run typecheck
bun run build
```

There is no account system and no environment secret. The app is one user on this computer. Screens cache their data with TanStack Query and refresh it after a save.

The desk opens in German. Switch to English with DE/EN in the sidebar, or under Mehr on a phone. Dates and amounts stay in German format. A printed invoice stays German.

## Where things live

- Engineering rules: `.grok/skills/managr-engineering/SKILL.md`
- Roadmap: `docs/ROADMAP.md`
- Legal and tax rules: `docs/DOMAIN.md`
- Structure: `docs/ARCHITECTURE.md`

An issued invoice can be downloaded as an XRechnung 3.0.2 file (the e-invoice). The desk does not send it. Version 1 does not include ELSTER, DATEV, ZUGFeRD, bank feeds, or a Lohnsteuer calculation. Those are listed in the roadmap so they are not pretended here.
