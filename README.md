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

## Docs

The notes in `docs/` are published with Docusaurus from `website/`.

```bash
bun install --cwd website
bun run docs
```

Open [http://localhost:3001/managr/](http://localhost:3001/managr/). A push to `main` builds the site and deploys it to GitHub Pages at [https://403access.github.io/managr/](https://403access.github.io/managr/). In the repository, Pages has to use GitHub Actions as its source. A pull request builds the site and does not deploy it. GitHub Free does not serve Pages for a private repository, so this private repository has to be public, or the account has to include Pages for private repositories, before that deploy can go live.

## Where things live

- Engineering rules: `.grok/skills/managr-engineering/SKILL.md`
- Roadmap: `docs/ROADMAP.md`
- Legal and tax rules: `docs/DOMAIN.md`
- Structure: `docs/ARCHITECTURE.md`
- Published site: `website/`

An issued invoice can be downloaded as an XRechnung 3.0.2 file (the e-invoice). The desk does not send it. Version 1 does not include ELSTER, DATEV, ZUGFeRD, bank feeds, or a Lohnsteuer calculation. Those are listed in the roadmap so they are not pretended here.
