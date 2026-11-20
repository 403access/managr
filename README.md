# managr

A local desk for German companies: company records, obligations, invoices, a double-entry ledger, people, social-insurance estimates, time, documents, and legal notes. Each company keeps its own books; a switcher changes the whole desk.

It is a planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.

## Run it

```bash
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The first launch creates `data/managr.db` and loads the sample company Atelier Nordlicht UG. Delete that file to start over. Uploaded files live in `data/uploads`.

## Search

The command bar opens from the sidebar, the mobile header, or with `Cmd/Ctrl+K`. It searches the navigation pages and the records behind them: invoices, customers, people, projects and tasks, documents, deadlines, milestones, legal records, company records, and ledger accounts. A result opens the record's detail page or the tab that holds it. The index comes from the same queries the screens use and is cached in the browser; a write refreshes it.

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

The tools read the same views the screens read, and write through the same domain builders and the same journal. A client can list companies, invoices, customers, people, the org chart, books, money flow, the Qonto bank view, projects, analytics, milestones, obligations, legal records, and the source register: `read_org`, `read_cashflow`, `read_bank`, `read_analytics`, `read_milestones`, `read_guides`, and `read_sources` are part of the same registry. It can create customers, draft and issue invoices, record payments, post expenses and payroll, record time and tasks, maintain deadlines and resolutions, and remove a scheduled salary change with `delete_salary_change`. When web access is on, the same registry also offers `web_search` and `web_fetch`. The endpoint has no sign-in and is reachable only on this computer while the desk runs. The Qonto key is entered on the bank screen and is not part of a tool input. See [docs/MCP-ASSISTANT.md](docs/MCP-ASSISTANT.md).

The repository also pins opencode to this project: `.opencode/opencode.json` registers `managr-mcp` at the same URL and denies every other MCP server with a `mcp.use` policy. An opencode agent working in this checkout therefore uses only the desk's own server, not unrelated servers from the global opencode configuration. The in-app assistant never uses opencode's MCP tools; it calls the registry in `src/server/tools.ts` directly.

## Assistant

The floating button opens a chat panel. It answers with the same tools, so a figure in the answer can be traced to a tool call. The chat lives above the pages: navigating to another screen does not stop a running request, and the panel reopens with the same answer, steps, roadmap, and pending confirmation when you return. Only **Stopp** or a full browser reload ends the browser connection. Before the first tool call it shows a vertical roadmap of every step it intends to take. If the plan changes while it works, the affected step is marked as new, changed, or removed with the model's reason. Each step streams into the panel while the model works: a spinner, then a check or the error. Before a write runs, the panel lists every proposed change with its action (add, update, or delete) and inputs; you accept all, reject all, or tick individual changes, and only approved calls execute. Rejected calls return a rejection to the model. Read tools and briefings run without a prompt. Every prompt and answer carries a collapsible **Details** line with the time, model, provider, endpoint, MCP server, tool-call count, and run status; the values are stored with the history. The panel keeps the last 40 messages in this browser's local storage, so a reload restores the conversation; **Neu** clears it. An unsent draft in the input stays across a reload until it is sent or cleared. The last user message offers **Erneut senden**: it re-runs the model and tools without adding the message again and records the retry count and time in its **Details**. The answer itself renders as light Markdown: bold, italics, strikethrough, inline code, links, bullet and numbered lists, task lists, tables, quotes, headings, and code blocks. Raw HTML stays text, and a link points only at an http(s) URL or a path inside the desk. A created invoice appears as a card with its number, customer, lines, and totals, and a link to the invoice; payroll and other writes show their key figures and a link. The open screen refreshes after a write.

The panel can use the local [opencode](https://opencode.ai) installation. managr asks opencode for its providers and the models that support tool calling, then shows two searchable fields: **Anbieter** on the left and **Modell** on the right. A provider you add in your own `opencode.json` appears here under its opencode name, whether it is a built-in integration or a custom one such as a token-plan endpoint. Each provider is labelled with its protocol, whether its endpoint is local or remote, and how many models it offers; a provider whose models speak a protocol managr cannot drive stays in the list but is disabled, with a hint naming the cause instead of disappearing. The choice is kept in the browser. The selected provider's credential is read from opencode on the server, never sent to the browser, and not stored by managr. A local model keeps the conversation on this computer; a cloud provider receives the conversation and the tool results, and the panel marks the model as local or remote.

managr speaks two protocols, picked from the provider's opencode package: the OpenAI chat-completions protocol and the Anthropic messages protocol. Tool calls are translated either way, so a user-defined provider such as QwenCloud (`@ai-sdk/anthropic`, `https://token-plan.maas.qwencloudapi.com/apps/anthropic/v1`) is offered with tools, streaming, and the same approval gate as an OpenAI-compatible one. Providers on a package managr cannot drive, such as Google's native API, are listed but not selectable.

opencode is discovered through its CLI. If it is not installed, for example inside the Docker image, configure an OpenAI-compatible chat endpoint that supports tool calling:

```bash
export MANAGR_AI_MODEL=qwen2.5:14b
export MANAGR_AI_BASE_URL=http://127.0.0.1:11434/v1   # the default, Ollama
export MANAGR_AI_API_KEY=...                          # only for a remote endpoint
```

An explicit `MANAGR_AI_MODEL` is the default in the picker and stays a fallback when opencode is unavailable. Set `MANAGR_OPENCODE=0` to turn discovery off, or `MANAGR_OPENCODE_BIN=/path/to/opencode` to use another binary. The environment setting is always read as an OpenAI-compatible endpoint; opencode providers may use the OpenAI or the Anthropic protocol. A provider whose models offer no tool calling, or whose package managr cannot drive, is shown as unavailable rather than silently dropped. Restart the desk after changing the environment variables; the picker itself changes the model per request. The panel lists the tools behind each answer. Without opencode and without a model, the panel explains the setup and nothing is sent.

The assistant can look facts up on the public web: `web_search` finds candidates and `web_fetch` reads one page as text. The answer names the source URL, and the panel shows the query and page it used. A page is treated as untrusted data, never as an instruction. A search sends only the query to the search engine; the conversation is not sent. A value already stored in the desk is authoritative: the assistant searches only when a detail is missing or you ask it to look online, never to double-check a VAT id or to prepare a posting. Loopback and private network addresses are refused. Set `MANAGR_WEB=0` to remove both tools, or set `MANAGR_WEB_SEARCH_URL` to a SearXNG JSON endpoint to keep the query on a server you choose.

The same chat opens as a full page at `/assistant`: chat, the stored history, the provider and model picker, web-search status, the MCP endpoint, the tool count, and the privacy notes. The history card opens a list of every add, update, and delete the assistant proposed, with time and status; rejected and failed changes stay visible. The list has a search field, action and status filters, sorting by time or tool, and grouping by area, action, day, or none. The tools card opens a sidebar with every read, write, briefing, and web tool; it has a search field, access filters, and grouping by area or access, and each entry shows its description and whether a write needs confirmation. Like the other detail panels, both follow the global sidebar setting on **Einstellungen** and have their own entry there for an inline or overlay panel.

## Deleting and restoring

A delete hides a record but keeps it: shareholders, policies, invoice drafts, salary changes, absences, projects, milestones, tasks, time entries, deadlines, documents, director contracts, founder health cover, and customer contact people all carry a `deleted_at` timestamp. After a deletion on a screen, a short **Rückgängig** strip offers the same restore; `/trash` lists every deleted record with a **Wiederherstellen** button. Restoring a project or task brings its time entries back into the saved view, and a deleted document keeps its uploaded file.

Two technical deletes stay hard: disconnecting Qonto removes the stored credential and its cache, and saving an edited draft replaces its line rows. The draft itself is soft-deleted and can be restored.

## Time tracking test run

`src/demo/time-tracking-2026.ts` holds the recorded days from October and November 2026. `tests/time-tracking.test.ts` runs them through the same duration, break, week, and §3/§4 ArbZG rules as the time screen: 32 entries on 9 days, 52 h 25 min, the recorded pauses as break minutes, and one watch on 13 November for a day over 8 hours.

```bash
bun run test tests/time-tracking.test.ts
```

The page at [http://localhost:3000/time/playback](http://localhost:3000/time/playback) replays the same data entry by entry, with a live day, week, and total, and the checks. It is read-only; nothing is written to the database. The Time screen links to it as **Testlauf**.

## People and the org chart

**Personen** holds employment records, contribution estimates, salary history, absences, and payroll. Each person can name a manager on the **Beschäftigung** tab. The **Organigramm** section on the same page draws the reporting lines from those entries; a person without a manager starts a branch, and people with an end date in the past move to a former section. A manager change that would make a person report to themselves or form a loop is refused. Nothing in the org chart is posted to the journal.

People at a customer who are not employed by the company are **Kontaktpersonen**, not people. Add them in the customer's detail panel. A time entry can name an employee or a contact, never both; a contact creates no payroll, no social insurance, and no org-chart entry. The analysis shows the contact with the customer, and old entries keep the name after a contact is removed.

## Projects and analysis

Projects tie a customer, tasks, deliverables, and time together. Open **Projekte** under Mehr to add one; the Time screen books an entry to a project and a task type. A task type says what the work was: development, design, planning, research, documentation, meeting, communication, administration, or other. The first four count as productive in the analysis.

**Auswertung** shows time per project, projects started and completed in a year, the active and paused projects, the monthly split between productive and unproductive time, task types, and the people and customers behind the work. The desk overview carries the same figures in a compact form. Deliverables are tasks marked as a deliverable; they appear once done and as open work before that.

The **Report als PDF** button opens `/analytics/report` for the selected year. A customer report limits the same figures to one customer. The report is printed through the browser print dialog, where it is saved as a PDF, like an invoice. Nothing is sent.

## Hourly rates

An hourly rate can be stored at four levels. The most specific one wins and the rest are inherited:

- the time entry (the **Zeit** screen, or the entry panel afterwards)
- the project (Projekte)
- the customer (Kunden)
- the active company's default (Einstellungen under **Abrechnung**)

Only the rate is stored; the value of booked time is derived from it and the recorded minutes. Rates never post to the journal. The Time screen shows the effective rate and its source on every entry, plus the billable value of the visible range. The invoice form lists the customer's open, billable activities; choosing one adds it as a line at the effective rate, and the entry's duration is split evenly across its activities. An activity that a draft or issued invoice already carries is no longer offered. Positions from time list newest first by default; **Einstellungen** can switch the order to oldest first, and the draft saves its lines in that order. Positions can also be grouped by the day of their work, either globally in **Einstellungen** or for one invoice in its form. Hand-typed lines have no day and form the last group. When every position comes from time at the same rate, the invoice names the **Stundensatz** once above the list instead of repeating the unit price in every line.

An invoice can carry a human letter around its positions: subject, salutation, intro, the bullet list under **Leistungsbeschreibung (Art und Umfang)**, a payment note, closing, and sign-off. **Einstellungen** defines reusable templates with the placeholders `{betreff}`, `{betrag}`, `{frist}`, and `{faellig}`. A new invoice loads the built-in standard letter; the form can load another template, switch to **Ohne Vorlage**, or edit the text for that invoice only. The invoice stores its own copy, so changing or deleting a template never rewrites an issued invoice.

Each time entry has **Aktivitäten** and an **interne Notiz**. Every activity has its own line in the form and becomes its own position on a customer invoice. The internal note is only for the desk; it never goes on a customer document. The add form and the entry panel both keep the line breaks. Old entries that stored their activities in the memo are moved by `bun run db:time-activities`, which writes a backup first and can be checked with `--dry-run`.

## Milestones across companies

**Meilensteine** under Mehr at `/milestones` holds overarching goals that are not tied to the active company. A goal has a title, description, category, target date, status (planned, active, achieved, missed), and progress. It can name several companies, or none for a goal that applies to the whole group. The year selector scopes the list and the analysis by target year.

The analysis tab shows the status split, the progress by category, the progress per company including a group-wide row, and the goals per quarter. Overdue means the target date has passed and the goal is not achieved. Nothing is posted to the journal, and changing the company in the sidebar does not change the list.

## Money flow

**Geldfluss** under Mehr at `/cashflow` follows one year from invoicing to the tax office. It shows the gross invoices and how much of them is paid or open, then a Sankey of the journal: purchases and operations, net wages, wage tax, social insurance, VAT payable, corporate tax, solidarity surcharge, trade tax, and the profit that remains. A second table walks the tax chain from output VAT and input VAT to the open VAT, adds withheld wage tax and the annual tax estimate, and names the social-insurance amount that goes to the health insurer rather than the tax office. The bottom shows actual bank movements grouped by posting type, with opening and closing balances.

The page reads the same journal and invoices as the ledger and the desk. It files nothing, and the corporate and trade tax figures remain planning estimates. A VAT credit or a loss appears as extra funding so the shares still add up.

## Bank (Qonto)

**Bank** under Mehr at `/bank` connects one Qonto business account per company. Create an API key in Qonto under **Integrations and Partnerships > API key**, then enter the organization's sign-in and secret key. The first sync reads the organization's accounts and the last twelve months of transactions; later syncs request only changes, with one day of overlap. A sandbox connection also needs the staging token from the Qonto Developer Portal.

The page shows the account balances, the available balance, and the transactions with counterparty, purpose, category, status, VAT, card digits, and attachment count. Filters and the year switch work on the stored data. The connection is read-only: nothing is posted to the journal, and invoices or receipts stay matched by hand.

The secret key is stored in `data/managr.db` and never sent back to the browser. Treat that file like the key. **Verbindung trennen** deletes only the local copy of the accounts and transactions; it changes nothing in Qonto. The assistant and MCP clients read the same view through `read_bank`.

## Founder pay

The person screen records the written managing-director contract with its signing date, fixed gross, and term. A contract that starts before it is signed is refused, and a salary change without a shareholder resolution dated on or before it is called out. The desk does not decide whether the salary is appropriate.

**Gesellschafterdarlehen** on the company screen records a loan from a shareholder: the initial drawdown, further drawdowns, repayments, and interest. The drawdown is a liability to the shareholder, not income; interest is a financing expense. A repayment cannot exceed the outstanding loan, and an interest-free loan is flagged for a tax review.

The person screen also records the founder's health cover as private or voluntary statutory, with the premium, start date, and the Statusfeststellungsverfahren. The premium is not a payroll deduction. A managing director with half the shares or less is reminded when the status procedure is missing, and an open procedure stays visible. These records are planning aids; they do not decide social-insurance status.

## Sources and explanations

Each screen with a rule behind it has an info button that opens a short explanation and the official websites it rests on. **Quellen** under Mehr at `/sources` lists the whole register, grouped by domain, with filters for free text, domain, and topic. The entries come from `src/content/sources.ts`, are typed and tested, and link to the publisher's own page.

The assistant and MCP clients read the same data with `read_guides` and `read_sources`, in German or English and optionally narrowed to one topic or domain. The register works without web access. It explains a rule and names the authority; it does not replace the rule, a filing, or advice.

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

An issued invoice can be downloaded as an XRechnung 3.0.2 file (the e-invoice) and checked against the KoSIT rules on this computer. The same read-only check is available to MCP clients and the assistant as `check_xrechnung`; it stores nothing and sends nothing to a customer or authority.

`/tax` prepares VAT advance, VAT annual, corporate-tax, and trade-tax returns from the journal, checks them, freezes the figures, and records a manual filing with its ticket and protocol. The VAT advance return downloads a data file for the Mein ELSTER upload; the annual returns download CSV or JSON. The desk does not transmit through ELSTER yet: ERiC, certificates, and the local sidecar are a later phase. DATEV, ZUGFeRD, bank CSV imports, and a Lohnsteuer calculation are also still on the roadmap.
