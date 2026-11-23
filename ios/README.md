# managr for iPhone

A native SwiftUI client for the managr desk. It talks to the Next.js app on your Mac over the local network and shows the same books: no account, no cloud, no copy of the database on the phone.

The phone and the Mac have to be on the same Wi-Fi. The Mac runs the desk; the app is the remote screen.

## What it does

- **Übersicht / Overview** — bank, receivables, profit before tax, open invoices, the next deadlines, open tasks, and this week's time.
- **Rechnungen / Invoices** — list, search, and filter by status; open an invoice; issue a draft; record a payment against the open amount. Totals, VAT, line items, payments, and blockers come from the same view the browser uses.
- **Kunden / Customers** — list, search, add, edit; see open amount, revenue, time, projects, and that customer's invoices.
- **Zeit / Time** — week navigation, totals, entries per day with activities and warnings; book a new entry; delete an entry (soft delete, restorable on the desk).
- **Assistent / Assistant** — chat with the model the desk is configured with: streaming answers, the roadmap, every tool call with its arguments and result, and a confirmation card before any write. Pick the provider and model at the top, retry the last question, and keep the last 40 messages on the phone. Reachable from **Mehr → Assistent** and the sparkles button on the overview.
- **Mehr / More** — people, projects, tasks (add and complete), statutory deadlines and custom dates (mark done), and settings.
- **Settings** — switch the active company, switch between German and English, check or change the connection.

Amounts and dates always use the German format, like the desk.

Not in the app yet: creating an invoice with time-linked positions, draft editing, documents and uploads, Qonto, tax filings, and the ledger. Use the browser for those.

## Requirements

- macOS with Xcode 16 or newer (built and tested with Xcode 27.2, iOS 27.2 SDK).
- iOS 17 or newer on the iPhone.
- The desk running on the Mac (`bun run dev`).
- A free Apple ID is enough to install on your own phone. The build then lasts 7 days; a paid Apple Developer account signs for a year.

## 1. Start the desk

```bash
bun install
bun run dev
```

Next prints two addresses:

```
- Local:   http://localhost:3000
- Network: http://192.168.1.20:3000
```

Use the **Network** address from the phone. `localhost` would mean the phone itself. Keep the desk running while you use the app.

Next already listens on `0.0.0.0`; no extra flag is needed. If macOS asks whether to allow incoming connections for Node, allow it.

## 2. Build and install

```bash
cd ios
xcodegen generate      # already done once; rerun after adding Swift files
open Managr.xcodeproj
```

In Xcode:

1. Open **Xcode → Settings → Accounts** and add your Apple ID if it is not listed. Without an account, signing fails with `No Account for Team` even when a development certificate exists in the keychain.
2. Select the **Managr** target → **Signing & Capabilities**.
3. Choose your **Team** under *Signing*. A personal Apple ID works. If the team is not offered, go back to *Accounts* and sign in again.
4. If Xcode complains that the bundle id is taken, change `PRODUCT_BUNDLE_IDENTIFIER` in `project.yml` (for example `de.yourname.managr`) and run `xcodegen generate` again. You can also change it directly under *General*.
5. Connect the iPhone with a cable, or enable **Connect via network** in the device menu. **Unlock the phone** and tap *Trust* when asked. Xcode reports `needs to be unlocked to enable development services` while the lock screen is showing.
6. Pick the iPhone as the run destination and press **Run** (⌘R). The first build may take a minute while Xcode creates the provisioning profile.

On the iPhone, the first launch may need:

- **Settings → General → VPN & Device Management →** your Apple ID → *Trust*.
- **Settings → Privacy & Security → Local Network → managr →** on. iOS asks the first time the app connects; if it was denied, this is where to fix it.

Then open managr, enter the Network address (for example `192.168.1.20:3000`), and tap **Verbinden**. `http://` and port `3000` are added automatically.

With a free Apple ID the app stops opening after 7 days. Run it from Xcode again to renew. A paid developer account removes that limit.

## If the connection fails

- iPhone and Mac must be on the same Wi-Fi, not one on cellular and one on Ethernet.
- Check the address on the Mac: `ipconfig getifaddr en0` (Wi-Fi) or the **Network** line from `bun run dev`.
- The Mac's IP can change after a reboot. Either enter the new address in the app (**Mehr → Einstellungen → Andere Adresse verwenden**) or give the Mac a fixed DHCP lease. A `.local` hostname such as `http://MacBook-Pro.local:3000` also works when Bonjour is available.
- Allow Node incoming connections in **System Settings → Network → Firewall** if it was blocked.
- If port 3000 is busy, start the desk with `bun run dev -p 3100` and enter `...:3100` in the app.
- HTTP is enabled for local networking by the app's ATS exception. Do not forward port 3000 to the internet.

## How it talks to the desk

Reads use the existing view route:

```
GET /api/views/desk
GET /api/views/invoices
GET /api/views/invoice?id=4
GET /api/views/time?week=2026-11-09
```

Writes use the JSON tool facade added for this client:

```http
POST /api/tools
Content-Type: application/json

{ "name": "record_invoice_payment",
  "arguments": { "invoiceId": 4, "amount": "1017,50", "paidOn": "2026-11-23" } }
```

```json
{ "ok": true, "data": { "amountCents": 101750, "paymentId": 9, "journalEntryId": 130 } }
```

That route wraps `src/server/tools.ts`, the same registry the MCP endpoint and the in-app assistant use. Validation, domain rules, and journal postings are identical. `GET /api/tools` lists every tool with its JSON schema.

The assistant uses the same desk routes as the browser:

```
GET  /api/assistant          → configured model and endpoint
GET  /api/assistant/models   → providers and models from opencode
POST /api/assistant          → NDJSON stream for one turn
POST /api/assistant/approve  → confirm or reject proposed writes
```

The stream is the web protocol unchanged: `model`, `delta`, `reset`, `tool`,
`tool_result`, `plan`, `proposal`, `reply`, and `error` lines. The phone folds
them into the same transcript. A write waits in a confirmation card; nothing
is posted until one of its buttons is tapped. Model configuration lives on the
Mac, not on the phone: install [opencode](https://opencode.ai) or set
`MANAGR_AI_MODEL`, `MANAGR_AI_BASE_URL`, and `MANAGR_AI_API_KEY` before
`bun run dev`. See [docs/MCP-ASSISTANT.md](../docs/MCP-ASSISTANT.md).

Next.js server actions are deliberately not used: their action ids are build artifacts and change on every build.

There is no authentication, like the rest of the desk. The endpoints are reachable by anything on the same network, so keep the desk on a trusted Wi-Fi and never expose port 3000 publicly.

## Project layout

```
ios/
  project.yml                  XcodeGen spec (target, signing, Info.plist, icon)
  Managr.xcodeproj             generated project, committed for convenience
  Managr/
    App/                       entry point and AppState (connection, locale, company)
    Core/                      DeskClient, JSONValue, models, formatting, status, strings
    Design/                    color tokens, panels, pills, typography
    Features/
      Connect/                 server address and instructions
      Root/                    splash and tab bar
      Dashboard/               overview
      Invoices/                list, detail, issue, payment sheet
      Customers/               list, detail, add/edit
      Time/                    week view and add-time form
      More/                    people, projects, tasks, deadlines
      Assistant/               chat, stream, roadmap, approvals, Markdown
      Settings/                connection, language, company, about
    Resources/                 Info.plist, asset catalog, app icon
```

### Regenerating the project

The Xcode target includes the whole `Managr/` folder, so a new Swift file is picked up automatically. After changing `project.yml` or adding resources:

```bash
cd ios
xcodegen generate
```

`xcodegen` is available through Homebrew (`brew install xcodegen`) if it is not installed.

### Signing and installing from the command line

After the account and team are configured in Xcode, build for the device:

```bash
cd ios
xcodebuild -project Managr.xcodeproj -scheme Managr \
  -destination 'generic/platform=iOS' \
  DEVELOPMENT_TEAM=YOURTEAMID \
  -allowProvisioningUpdates build
```

With the iPhone unlocked and paired, list its UDID and install the signed app:

```bash
xcrun devicectl list devices
xcrun devicectl device install app --device <iphone-udid> \
  ~/Library/Developer/Xcode/DerivedData/Managr-*/Build/Products/Debug-iphoneos/managr.app
xcrun devicectl device process launch --device <iphone-udid> de.managr.desk
```

Opening the project in Xcode is simpler for a one-off install; the command line is useful for repeating it.

## Privacy

The app stores the desk address, the language, the last 40 assistant messages, an unsent draft, and the model choice in `UserDefaults`. Nothing else is cached; each screen fetches from the desk. Requests are plain HTTP on the local network because that is what the desk serves. There is no analytics and no third-party SDK. A remote model endpoint receives the conversation and tool results when you configure one on the Mac; a local model keeps them on the Mac.