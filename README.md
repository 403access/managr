# managr

A local desk for one German UG (haftungsbeschränkt): company records, obligations, invoices, a double-entry ledger, people, social-insurance estimates, time, documents, and legal notes.

It is a planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/managr.db` and loads the sample company Atelier Nordlicht UG. Delete that file to start over. Uploaded files live in `data/uploads`.

## Demo and production books

The desk always opens `data/managr.db`. Two saved copies sit beside it: `data/managr.demo.db` and `data/managr.production.db`. Stop the desk before switching, then:

```bash
bun run db:demo      # open the demo copy
bun run db:prod      # open the production copy
bun run db:status    # show the active copy and both saved files
```

Save the currently open books as either copy:

```bash
bun run db:demo:set
bun run db:prod:set
```

When you switch away from a copy, the open database is saved back to that copy first, so edits are not lost. An open database that has not been saved as a copy is kept as `data/managr.unsaved-<timestamp>.db` before the first switch. `--from` imports another SQLite file into a copy, for example `bun run db:prod:set -- --from ~/backup/managr.db`. If the copy is already active, add `--force` to load the saved copy over the open one. Start the desk again after a switch because the running server keeps its open connection. Uploads in `data/uploads` are shared by both copies.

```bash
docker compose up --build
```

That runs the same desk at [http://localhost:3000](http://localhost:3000) and the site at [http://localhost:3001/managr/](http://localhost:3001/managr/). The notes are at [http://localhost:3001/managr/docs](http://localhost:3001/managr/docs). Compose keeps the database and uploads in `data/` on this computer. It does not host the desk for anyone else.

The stack also runs the KoSIT validator as a third container. Its daemon is published only on `127.0.0.1:8090`; the desk reaches it at `http://validator:8080`. Check it with:

```bash
curl -X POST http://127.0.0.1:8090/invoice.xml \
  -H 'Content-Type: application/xml' \
  --data-binary @invoice.xml
```

The answer is 200 for an acceptable file and 406 for a rejected one, with the validation report as XML. `docs/XRECHNUNG-VALIDATION.md` records the versions and the endpoint.

```bash
bun run test
bun run typecheck
bun run build
```

There is no account system and no environment secret. The app is one user on this computer. Screens cache their data with TanStack Query and refresh it after a save.

The desk opens in German. Switch to English with DE/EN in the sidebar, or under Mehr on a phone. Dates and amounts stay in German format. A printed invoice stays German.

## Site

`website/` is the public site. The marketing page is the root. Docusaurus serves the notes in `docs/` at `/docs`.

```bash
bun install --cwd website
bun run docs
```

Open [http://localhost:3001/managr/](http://localhost:3001/managr/). The notes are at [http://localhost:3001/managr/docs](http://localhost:3001/managr/docs). `/architecture`, `/domain`, and `/roadmap` redirect to the same notes under `/docs`. A push to `main` builds the site and deploys it to GitHub Pages at [https://403access.github.io/managr/](https://403access.github.io/managr/), with the notes at [https://403access.github.io/managr/docs](https://403access.github.io/managr/docs). In the repository, Pages has to use GitHub Actions as its source. A pull request builds the site and does not deploy it. GitHub Free does not serve Pages for a private repository, so this private repository has to be public, or the account has to include Pages for private repositories, before that deploy can go live.

## Where things live

- Engineering rules: `.grok/skills/managr-engineering/SKILL.md`
- Roadmap: `docs/ROADMAP.md`
- Legal and tax rules: `docs/DOMAIN.md`
- Structure: `docs/ARCHITECTURE.md`
- Published site: `website/` (marketing page, docs at `/docs`)

An issued invoice can be downloaded as an XRechnung 3.0.2 file (the e-invoice). The desk does not send it. Version 1 does not include ELSTER, DATEV, ZUGFeRD, bank feeds, or a Lohnsteuer calculation. Those are listed in the roadmap so they are not pretended here.
