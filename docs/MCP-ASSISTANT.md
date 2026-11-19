---
slug: /mcp
---

# Assistant and MCP

managr gets one tool layer that drives the desk, reached from two places:

- **In the app:** a chat widget that turns a sentence into the same calls the screens make.
- **From outside:** an MCP server at `/api/mcp`, so another agent (Claude Desktop, an IDE, a script) can read and post to the desk.

Both surfaces use the same registry in `src/server/tools.ts`. There is no second set of business rules: each tool calls the domain builders in `src/domain` and the posting path in `src/server/posting.ts`. The screens and the assistant therefore produce the same numbers.

## Status

All four phases have shipped. The widget is in the app shell, the MCP endpoint answers at `/api/mcp`, and the registry has read tools, write tools, and four deterministic briefings. The registry follows the screens: the org chart, the Qonto bank view, the money-flow page, analytics, milestones, the source register, and the tax-return workspace are all reachable. The phase headings below describe what each one added.

## Boundaries

- The assistant is a caller, not an authority. It may not file, send, or decide a tax or legal question, and it must not invent a wage-tax figure or a social-insurance status.
- Books stay append-only. Corrections are reversing entries, exactly as on the screens.
- Nothing is sent. No e-invoice, no e-mail, no ELSTER, no Peppol. The tax tools read, prepare, calculate, check, and annotate a return, but never release or transmit it; the release and the manual-filing evidence stay on the screen.
- File uploads stay on the screen. A tool may list documents, not write or delete files. The Qonto connection is set up on the bank screen; a tool reads the stored bank view and does not hold the key.
- The assistant reaches a model only through the local opencode installation or the endpoint you configure. With a local model (Ollama or a local OpenAI-compatible server) the data stays on this computer; with a cloud model, the conversation and the tool results leave it. The widget says which model and provider are in use.
- The provider credential stays on the server. managr reads it from opencode for the selected model, sends it only to that provider, and never returns it to the browser or stores it in the database.
- `web_search` sends only the query to a search engine. `web_fetch` requests one public page. The conversation is not sent, loopback and private network addresses are refused, and a page is untrusted data: the assistant may quote a fact, never follow an instruction from it.

## Configuration

| Variable | Meaning |
| --- | --- |
| `MANAGR_AI_MODEL` | The fallback model name. Without opencode and without this value the widget and the route refuse to answer. |
| `MANAGR_AI_BASE_URL` | The fallback OpenAI-compatible base URL. Defaults to `http://127.0.0.1:11434/v1` (Ollama). |
| `MANAGR_AI_API_KEY` | Sent as a bearer token for the fallback endpoint when set. Not needed for a local endpoint. |
| `MANAGR_OPENCODE` | Set to `0` to skip the local opencode installation. Discovery is on by default. |
| `MANAGR_OPENCODE_BIN` | Path to the opencode binary when it is not on `PATH`. |
| `MANAGR_WEB` | Set to `0` to remove `web_search` and `web_fetch` from the assistant and MCP. On by default. |
| `MANAGR_WEB_SEARCH_URL` | A SearXNG JSON endpoint. It is tried before DuckDuckGo and Bing, so the query stays on a server you choose. |

A loopback base URL counts as local. Any other host counts as remote, and the panel says so. The widget reads the fallback setting from `GET /api/assistant`; the key is never returned. The desk says nothing about the model's own data handling.

## Model choice

When a local opencode installation is available, `GET /api/assistant/models` returns its providers and the models that support tool calling over an OpenAI-compatible endpoint. The panel renders two searchable fields, provider on the left and model on the right, and stores the choice in the browser. Each message carries `selection: { providerID, modelID }` to `POST /api/assistant`.

The route resolves the selection against opencode on every request. A model that disappeared from opencode is refused with a 400 instead of being replaced silently. The provider's credential is read on the server from opencode's local credential store and is never part of the catalog response. The catalog is cached in the server process for a minute; a change in opencode appears after that or on the next request after the cache expires.

The environment variables stay a working fallback and appear in the picker as the **Environment** provider. An explicit `MANAGR_AI_MODEL` is the default selection. Without either source the panel shows the setup card. Docker images normally have no opencode, so the environment path is the normal one there.

Only chat models that speak the OpenAI chat-completions protocol with tool calling are listed. A provider that opencode reaches through its native Anthropic or Google route is not offered, because managr's assistant keeps its own tool loop and sends OpenAI-shaped tool calls.

## Web tools

`web_search` asks DuckDuckGo's HTML endpoint for up to ten results and falls back to Bing. With `MANAGR_WEB_SEARCH_URL` it asks a SearXNG JSON endpoint first. It returns a title, URL, and snippet per result. `web_fetch` accepts only public http(s) URLs, follows at most five redirects with the same check, caps the download at 2 MB, strips scripts and markup, and returns the readable text, the title, and any email addresses it finds. Both tools cache for five minutes in the server process.

The tools are read-only: they never invalidate a screen and never post. `MANAGR_WEB=0` removes them from the registry that the assistant and MCP see, and `runTool` refuses them. The system prompt requires a source URL for every web fact, tells the model to list same-name companies instead of choosing one, and allows a search only when a detail is missing from the desk or the user asks for an online check. A stored VAT id, address, or contact is authoritative and is not re-checked on the web; a time entry or posting never needs a lookup. A page is treated as untrusted data; an instruction on it is never followed.

## Reference tools

`read_guides` and `read_sources` expose the in-app source register in `src/content/sources.ts`. A guide has a title, a summary, sections, and a list of source ids; a source has a publisher, a kind, a note, and one official https URL. The tools default to German and accept `locale: "en"`; `read_guides` narrows to one topic with `topic`, and `read_sources` narrows with `query`, `domain`, or `topic`.

The register is local data, so the tools work with `MANAGR_WEB=0`. They are read-only. A guide explains a screen; it is not a ruling and not a posting. The system prompt tells the model to name the official URL a guide cites instead of inventing a rule or a rate.

## Phases

### Phase 1 — tool registry and MCP server (shipped)

A single registry with a name, a description, a Zod input schema, and a run function per tool. A tool result is `{ ok, data }` or `{ ok: false, error }`.

Read tools render the existing views, so the assistant sees the same JSON a screen sees:

- `read_companies`, `read_desk`, `read_company`, `read_shareholder_loans`
- `read_customers`, `read_contacts`
- `read_invoices`, `read_invoice`
- `read_ledger`, `read_cashflow`, `read_bank`
- `read_people`, `read_person`, `read_org`
- `read_time`, `read_tasks`
- `read_projects`, `read_analytics`, `read_milestones`
- `read_obligations`, `read_documents`, `read_legal`
- `read_guides`, `read_sources`
- `web_search`, `web_fetch` when web access is on

Write tools follow the server actions:

- **Company:** `switch_company`, `create_company`, `update_company_identity`, `update_tax_profile`, `update_bank`
- **Shareholders, reserve, cover:** `add_shareholder`, `delete_shareholder`, `add_shareholder_loan`, `record_shareholder_loan_movement`, `record_reserve_allocation`, `offset_reserve`, `add_policy`, `delete_policy`, `pay_profit_distribution`
- **Invoices:** `save_customer`, `save_contact`, `delete_contact`, `create_invoice`, `issue_invoice`, `update_buyer_reference`, `record_invoice_payment`, `void_invoice`, `delete_invoice_draft`
- **Books:** `post_expense`, `post_vat_prepayment`, `post_journal_entry`
- **People:** `create_person`, `update_person`, `add_salary_change`, `delete_salary_change`, `save_director_contract`, `delete_director_contract`, `save_founder_health`, `delete_founder_health`, `add_absence`, `delete_absence`, `post_payroll`, `pay_shareholder`
- **Time, tasks, deadlines:** `add_time`, `update_time`, `delete_time`, `save_project`, `delete_project`, `set_hourly_rate`, `add_task`, `set_task_status`, `delete_task`, `set_obligation`, `add_deadline`, `complete_deadline`, `delete_deadline`
- **Planning:** `update_plan`. `add_time` and `update_time` take `personId` for an employee or `contactId` for an external contact, never both.
- **Milestones:** `save_milestone`, `delete_milestone`
- **Legal:** `set_compliance_done`, `save_resolution`

The MCP endpoint uses the SDK's Streamable HTTP transport in stateless mode with JSON responses. It speaks the standard `initialize`, `tools/list`, and `tools/call` flow. It is available only while the desk runs and only on the machine that runs it.

Read tools cover every screen: the desk, company, customers, invoices, ledger, money flow, Qonto bank, people, org chart, time, tasks, projects, analytics, milestones, obligations, documents, legal records, and the source register. `read_org` returns the same top-down tree as the People page, including former people and the depth. `read_guides` returns the explanation behind a screen with its sections and cited sources; `read_sources` returns the register grouped by domain, optionally filtered by query, domain, or guide. Both read `src/content/sources.ts`, so the assistant can name the same official link the info column shows.

The Qonto connection itself stays on the bank screen, like a file upload. A tool reads the stored accounts, balances, and transactions through `read_bank`; it does not create or remove the connection.

### Phase 2 — the widget (shipped)

A floating button in the app shell opens a panel. The browser sends the conversation to `POST /api/assistant`. The route asks the model with `stream: true` and answers with newline-delimited JSON, one event per line:

- `model`: the endpoint and model in use.
- `delta`: a text chunk of the answer.
- `reset`: the streamed text was only a preamble to a tool call and is withdrawn.
- `tool`: a tool call started, with its input.
- `tool_result`: the call finished, with `ok`, a summary, and a capped copy of the data.
- `proposal`: one or more write calls are waiting for confirmation, with a `proposal` id and each change's call id, tool, action (`add`, `update`, `delete`), and input.
- `plan`: the roadmap the assistant intends to follow, with stable step ids, statuses, and notes. A later `plan` event replaces it; the panel keeps removed steps visible and marks additions, changes, and removals.
- `reply`: the final answer text.
- `error`: the run failed, with a message.

The panel answers a `proposal` with `POST /api/assistant/approve` and `{ id, approved: [callId, ...] }`. The call ids that are not listed are rejected. The original stream then continues with the tool results, so the model sees which changes ran and which did not. A proposal expires after ten minutes; closing the panel or pressing Stop rejects the remaining calls.

The panel renders each event as it arrives, so the steps appear while the model is still working:

- The provider and model come from the local opencode installation; `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL`, and `MANAGR_AI_API_KEY` remain the fallback. Without either source the panel explains the setup instead of pretending to answer.
- Each tool call shows a spinner, then a check or a cross with the error. A read shows no card; a write shows what it created. A web search shows the query and hit count, and a fetched page shows its URL.
- Before a write tool runs, the panel shows a confirmation card with every proposed change: its action (add, update, or delete), the tool, and its inputs. **Alle übernehmen** accepts the batch, **Alle ablehnen** rejects it, and the checkboxes plus **Auswahl übernehmen** accept or reject individual changes. Only approved calls execute; a rejected call returns a rejection result to the model. Read tools and the four briefings never ask. This applies to the in-app assistant; an external MCP client still calls a tool directly.
- The assistant starts with a visible roadmap. It calls `update_plan` before its first desk tool, then updates the same plan as it works. Added, changed, and dropped steps carry the reason from the step note; the roadmap stays above the tool steps and is stored with the answer.
- The same chat opens as a full page at `/assistant`. It keeps the provider and model picker and adds the stored history, web-search status, the MCP endpoint, the tool count, and the privacy notes. The history card opens a list of every add, update, and delete the assistant proposed, with time and status; rejected and failed changes stay visible. The list has a search field, action and status filters, sorting by time or tool, and grouping by area, action, day, or none. The tools card opens a searchable sidebar with access filters and grouping by area or access; each entry shows its description, and a write is marked as needing confirmation. Both panels follow the global detail-sidebar setting and are listed on the settings page as **KI**, so they can be inline or overlay.
- A delete hides the record instead of removing it. Shareholders, policies, invoice drafts, salary changes, absences, projects, milestones, tasks, time entries, deadlines, documents, director contracts, and founder health cover can be restored from `/trash`; the last screen deletion also offers **Rückgängig**. Projects and tasks bring their time entries back when restored. Qonto disconnect and the line replacement inside an edited draft remain hard deletes.
- The answer renders as light Markdown: bold, italics, strikethrough, inline code, links, bullet and numbered lists, task lists, tables, quotes, headings, and code blocks. A marker without its pair stays visible while the text streams. Raw HTML stays text, and a link points only at an `http(s)` URL or a path inside the desk.
- The conversation is kept in the browser's local storage, so a reload restores the last 40 messages with their steps. **Neu** clears the panel and the stored history. An unsent draft in the input is kept in the same browser until it is sent or cleared. The last user message offers **Erneut senden**: it calls the model and the tool registry again without adding a duplicate message, replaces the old answer, and records the retry count and time in the message details. The model still receives only the visible conversation text; the store never leaves the browser unless the conversation is sent to the configured model.
- Every prompt and answer shows a collapsible **Details** line: local time, model and provider, endpoint with local/remote, the MCP server (`managr-mcp`), the tool-call count on an answer, and the run status (OK, error, stopped). The values are stored with the chat, so they survive a reload.
- The request carries at most the recent turns. A tool-only assistant turn with no text, and any older turn beyond the window, is dropped before the model call, so a long restored conversation never makes the next question fail with "the message could not be read". A rejected body names its reason in the server log.
- This repository ships `.opencode/opencode.json`: it registers `managr-mcp` at `/api/mcp` and denies every other MCP server through `mcp.use` policies. A local opencode agent in this checkout therefore uses only the desk's own server. The in-app assistant never uses opencode's MCP tools; it calls `src/server/tools.ts` directly.
- A created, issued, paid, or voided invoice shows a card with number, customer, lines, net, VAT, gross, and open amount, plus a link to the invoice. A payroll posting shows gross, wage tax, net, and employer share, plus a link to the person. Other writes link to their screen.
- After a write the panel invalidates the open view, so a list behind the panel updates at the same moment.
- A Stop button aborts the request and keeps the steps that already ran.
- Quick actions start a common request: a briefing, the open invoices, the next deadlines, the month-end check.
- Works at 375px width and on the desktop sidebar.

### Phase 3 — more than the screens (shipped)

Four deterministic helpers that need no model, usable from the widget and from MCP:

- `daily_briefing`: cash, receivables, profit before tax, VAT payable, overdue invoices, deadlines in the next 14 days, open tasks.
- `vat_overview`: output VAT, input VAT, prepayments, and the payable or refund amount for a chosen period.
- `monthly_close_checklist`: company particulars, open drafts, payroll months that are not posted, and obligations due in the month.
- `draft_dunning_letter`: a German payment reminder for one overdue invoice. The text is a draft; the desk does not send it.

The assistant can already compose an invoice draft from free text by calling `create_invoice`, and record a payment by calling `record_invoice_payment`. Both keep the §14 UStG checks on issue.

### Phase 4 — documentation and the site (shipped)

- `docs/MCP-ASSISTANT.md` (this page), `docs/ARCHITECTURE.md`, and `docs/DOMAIN.md` name the tools, the boundary, and the configuration.
- The README shows how to start the desk and point a client at `/api/mcp`.
- The marketing page mentions the assistant and says plainly that a cloud model receives the conversation.

## Not in this version

- Remote hosting, accounts, and roles for the MCP endpoint.
- Writing into the books through a tool without the domain checks.
- Sending an e-invoice, an e-mail, or a filing.
- Uploading or deleting document files through a tool.
- Creating, renewing, or removing the Qonto connection through a tool.
- Letting the assistant approve its own invoice issue or decide a social-insurance status.

## Done

A phase is done when the registry tests pass, `bun run test` and `bun run typecheck` pass, the changed screens work at phone and desktop width, and this page, the architecture note, and the README describe the behavior that shipped.