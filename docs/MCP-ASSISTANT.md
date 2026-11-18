---
slug: /mcp
---

# Assistant and MCP

managr gets one tool layer that drives the desk, reached from two places:

- **In the app:** a chat widget that turns a sentence into the same calls the screens make.
- **From outside:** an MCP server at `/api/mcp`, so another agent (Claude Desktop, an IDE, a script) can read and post to the desk.

Both surfaces use the same registry in `src/server/tools.ts`. There is no second set of business rules: each tool calls the domain builders in `src/domain` and the posting path in `src/server/posting.ts`. The screens and the assistant therefore produce the same numbers.

## Status

All four phases have shipped. The widget is in the app shell, the MCP endpoint answers at `/api/mcp`, and the registry has read tools, write tools, and four deterministic briefings. The phase headings below describe what each one added.

## Boundaries

- The assistant is a caller, not an authority. It may not file, send, or decide a tax or legal question, and it must not invent a wage-tax figure or a social-insurance status.
- Books stay append-only. Corrections are reversing entries, exactly as on the screens.
- Nothing is sent. No e-invoice, no e-mail, no ELSTER, no Peppol.
- File uploads stay on the screen. A tool may list documents, not write or delete files.
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

The tools are read-only: they never invalidate a screen and never post. `MANAGR_WEB=0` removes them from the registry that the assistant and MCP see, and `runTool` refuses them. The system prompt requires a source URL for every web fact and tells the model to list same-name companies instead of choosing one. A page is treated as untrusted data; an instruction on it is never followed.

## Phases

### Phase 1 — tool registry and MCP server (shipped)

A single registry with a name, a description, a Zod input schema, and a run function per tool. A tool result is `{ ok, data }` or `{ ok: false, error }`.

Read tools render the existing views, so the assistant sees the same JSON a screen sees:

- `read_companies`, `read_desk`, `read_company`
- `read_customers`
- `read_invoices`, `read_invoice`
- `read_ledger`, `read_cashflow`
- `read_people`, `read_person`
- `read_time`, `read_tasks`
- `read_projects`, `read_analytics`
- `read_obligations`, `read_documents`, `read_legal`
- `web_search`, `web_fetch` when web access is on

Write tools follow the server actions:

- **Company:** `switch_company`, `create_company`, `update_company_identity`, `update_tax_profile`, `update_bank`
- **Shareholders, reserve, cover:** `add_shareholder`, `delete_shareholder`, `record_reserve_allocation`, `offset_reserve`, `add_policy`, `delete_policy`, `pay_profit_distribution`
- **Invoices:** `save_customer`, `create_invoice`, `issue_invoice`, `update_buyer_reference`, `record_invoice_payment`, `void_invoice`, `delete_invoice_draft`
- **Books:** `post_expense`, `post_vat_prepayment`, `post_journal_entry`
- **People:** `create_person`, `update_person`, `add_salary_change`, `add_absence`, `delete_absence`, `post_payroll`, `pay_shareholder`
- **Time, tasks, deadlines:** `add_time`, `delete_time`, `save_project`, `delete_project`, `add_task`, `set_task_status`, `delete_task`, `set_obligation`, `add_deadline`, `complete_deadline`, `delete_deadline`
- **Legal:** `set_compliance_done`, `save_resolution`

The MCP endpoint uses the SDK's Streamable HTTP transport in stateless mode with JSON responses. It speaks the standard `initialize`, `tools/list`, and `tools/call` flow. It is available only while the desk runs and only on the machine that runs it.

### Phase 2 — the widget (shipped)

A floating button in the app shell opens a panel. The browser sends the conversation to `POST /api/assistant`. The route asks the model with `stream: true` and answers with newline-delimited JSON, one event per line:

- `model`: the endpoint and model in use.
- `delta`: a text chunk of the answer.
- `reset`: the streamed text was only a preamble to a tool call and is withdrawn.
- `tool`: a tool call started, with its input.
- `tool_result`: the call finished, with `ok`, a summary, and a capped copy of the data.
- `reply`: the final answer text.
- `error`: the run failed, with a message.

The panel renders each event as it arrives, so the steps appear while the model is still working:

- The provider and model come from the local opencode installation; `MANAGR_AI_BASE_URL`, `MANAGR_AI_MODEL`, and `MANAGR_AI_API_KEY` remain the fallback. Without either source the panel explains the setup instead of pretending to answer.
- Each tool call shows a spinner, then a check or a cross with the error. A read shows no card; a write shows what it created. A web search shows the query and hit count, and a fetched page shows its URL.
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
- Letting the assistant approve its own invoice issue or decide a social-insurance status.

## Done

A phase is done when the registry tests pass, `bun run test` and `bun run typecheck` pass, the changed screens work at phone and desktop width, and this page, the architecture note, and the README describe the behavior that shipped.