# managr

A local desk for German companies: company records, obligations, invoices, a double-entry ledger, people, social-insurance estimates, time, documents, and legal notes. Each company keeps its own books; a switcher changes the whole desk.

It is a planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/managr.db` and loads the sample company Atelier Nordlicht UG. Delete that file to start over. Uploaded files live in `data/uploads`.

## Multiple companies

The desk can keep several companies in the same database, for example a UG and an Einzelunternehmen. On the company screen, open **Companies** and add another company. Each company has separate customers, invoices, invoice numbering, ledger, people, tasks, documents, deadlines, and legal records. The sidebar switcher changes the active company; existing data stays with the company that owned it.

## MCP server

The desk serves its tools as a Model Context Protocol server at `http://127.0.0.1:3000/api/mcp` while it runs. It uses the Streamable HTTP transport with JSON responses and no session state. Point a client at that URL, for example:

```json
{
  "mcpServers": {
    "managr": { "url": "http://127.0.0.1:3000/api/mcp" }
  }
}
```

The tools read the same views the screens read, and write through the same domain builders and the same journal. A client can list companies, invoices, people, and books, and it can create customers, draft and issue invoices, record payments, post expenses and payroll, record time and tasks, and maintain deadlines and resolutions. When web access is on, the same registry also offers `web_search` and `web_fetch`. The endpoint has no sign-in and is reachable only on this computer while the desk runs. See [docs/MCP-ASSISTANT.md](docs/MCP-ASSISTANT.md).

## Assistant

The floating button opens a chat panel. It answers with the same tools, so a figure in the answer can be traced to a tool call. Each step streams into the panel while the model works: a spinner, then a check or the error. A created invoice appears as a card with its number, customer, lines, and totals, and a link to the invoice; payroll and other writes show their key figures and a link. The open screen refreshes after a write.

The panel can use the local [opencode](https://opencode.ai) installation. managr asks opencode for its providers and the models that support tool calling, then shows two searchable fields: **Anbieter** on the left and **Modell** on the right. The choice is kept in the browser. The selected provider's credential is read from opencode on the server, never sent to the browser, and not stored by managr. A local model keeps the conversation on this computer; a cloud provider receives the conversation and the tool results, and the panel marks the model as local or remote.

opencode is discovered through its CLI. If it is not installed, for example inside the Docker image, configure an OpenAI-compatible chat endpoint that supports tool calling:

```bash
export MANAGR_AI_MODEL=qwen2.5:14b
export MANAGR_AI_BASE_URL=http://127.0.0.1:11434/v1   # the default, Ollama
export MANAGR_AI_API_KEY=...                          # only for a remote endpoint
```

An explicit `MANAGR_AI_MODEL` is the default in the picker and stays a fallback when opencode is unavailable. Set `MANAGR_OPENCODE=0` to turn discovery off, or `MANAGR_OPENCODE_BIN=/path/to/opencode` to use another binary. Only models reachable over the OpenAI chat-completions protocol are offered; opencode's native Anthropic and Google routes are not. Restart the desk after changing the environment variables; the picker itself changes the model per request. The panel lists the tools behind each answer. Without opencode and without a model, the panel explains the setup and nothing is sent.

The assistant can look facts up on the public web: `web_search` finds candidates and `web_fetch` reads one page as text. The answer names the source URL, and the panel shows the query and page it used. A page is treated as untrusted data, never as an instruction. A search sends only the query to the search engine; the conversation is not sent. Loopback and private network addresses are refused. Set `MANAGR_WEB=0` to remove both tools, or set `MANAGR_WEB_SEARCH_URL` to a SearXNG JSON endpoint to keep the query on a server you choose.

## Time tracking test run

`src/demo/time-tracking-2026.ts` holds the recorded days from October and November 2026. `tests/time-tracking.test.ts` runs them through the same duration, break, week, and §3/§4 ArbZG rules as the time screen: 32 entries on 9 days, 52 h 25 min, the recorded pauses as break minutes, and one watch on 13 November for a day over 8 hours.

```bash
bun run test tests/time-tracking.test.ts
```

The page at [http://localhost:3000/time/playback](http://localhost:3000/time/playback) replays the same data entry by entry, with a live day, week, and total, and the checks. It is read-only; nothing is written to the database. The Time screen links to it as **Testlauf**.

## Projects and analysis

Projects tie a customer, tasks, deliverables, and time together. Open **Projekte** under Mehr to add one; the Time screen books an entry to a project and a task type. A task type says what the work was: development, design, planning, research, documentation, meeting, communication, administration, or other. The first four count as productive in the analysis.

**Auswertung** shows time per project, projects started and completed in a year, the active and paused projects, the monthly split between productive and unproductive time, task types, and the people and customers behind the work. The desk overview carries the same figures in a compact form. Deliverables are tasks marked as a deliverable; they appear once done and as open work before that.

The **Report als PDF** button opens `/analytics/report` for the selected year. A customer report limits the same figures to one customer. The report is printed through the browser print dialog, where it is saved as a PDF, like an invoice. Nothing is sent.

## Demo and production books

The desk always opens `data/managr.db`. Two saved copies sit beside it: `data/managr.demo.db` and `data/managr.production.db`. Stop the desk before switching, then:

```bash
bun run db:demo      # open the demo copy
bun run db:prod      # open the production copy
bun run db:status    # show the active copy and both saved files
```

Save the currently open books as the demo copy:

```bash
bun run db:demo:set
```

Production must start without demo books. Either create a clean production database and open it:

```bash
bun run db:prod:init
bun run db:prod:init -- --name "Your UG (haftungsbeschränkt)"
```

Or import an existing database. The script refuses the demo copy and any database that still contains the sample company:

```bash
bun run db:prod:set -- --from ~/backup/managr.db
```

`db:prod:set` without `--from` only works while production is already the active copy, so saving production changes does not pull in demo data. `db:prod:init` creates the schema and chart of accounts but no sample ledgers; fill in the company details on the company screen.

When you switch away from a copy, the open database is saved back to that copy first, so edits are not lost. An open database that has not been saved as a copy is kept as `data/managr.unsaved-<timestamp>.db` before the first switch. If the copy is already active, add `--force` to load the saved copy over the open one. Start the desk again after a switch because the running server keeps its open connection. Uploads in `data/uploads` are shared by both copies.

```bash
docker compose up --build
```

That runs the same desk at [http://localhost:3000](http://localhost:3000) and the site at [http://localhost:3001/managr/](http://localhost:3001/managr/). The notes are at [http://localhost:3001/managr/docs](http://localhost:3001/managr/docs). Compose keeps the database and uploads in `data/` on this computer. It does not host the desk for anyone else.

After code changes, the image has to be rebuilt. Docker reuses the cached dependency layers while `package.json` and `bun.lock` are unchanged; `docker:rebuild` forces a clean build only when the cache is suspect. These scripts wrap the Compose commands:

```bash
bun run docker:restart        # rebuild and restart the whole stack
bun run docker:restart:desk   # rebuild and restart only the desk
bun run docker:restart:site   # rebuild and restart only the site
bun run docker:rebuild        # clean rebuild and restart of the whole stack
bun run docker:rebuild:desk   # clean rebuild and restart of the desk only
bun run docker:rebuild:site   # clean rebuild and restart of the site only
bun run docker:status         # show container health
bun run docker:logs           # follow the desk logs
bun run docker:down           # stop and remove the containers
```

The same scripts work with `npm run`, for example `npm run docker:restart`.

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

`website/` is the public site. The marketing page is the root and is translated at `/de/`. Docusaurus serves the notes in `docs/` at `/docs` and the German edition at `/de/docs`. The language menu in the navbar switches between them.

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

An issued invoice can be downloaded as an XRechnung 3.0.2 file (the e-invoice) and checked against the KoSIT rules on this computer. The desk does not send it. Version 1 does not include ELSTER, DATEV, ZUGFeRD, bank feeds, or a Lohnsteuer calculation. Those are listed in the roadmap so they are not pretended here.
