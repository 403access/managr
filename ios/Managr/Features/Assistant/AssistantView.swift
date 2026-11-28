import SwiftUI

/// The chat screen: model choice, transcript, open turn, confirmation cards,
/// and the composer. It is pushed from More and presented as a sheet from the
/// dashboard, so it takes an optional close action instead of owning a sheet.
struct AssistantView: View {
    @Environment(AppState.self) private var app
    @Environment(AssistantStore.self) private var store
    @FocusState private var inputFocused: Bool
    @State private var showModelPicker = false
    let onClose: (() -> Void)?

    init(onClose: (() -> Void)? = nil) {
        self.onClose = onClose
    }

    var body: some View {
        @Bindable var store = store
        VStack(spacing: 0) {
            statusBar
            Divider().overlay(Theme.line)
            transcript
            composer(store: $store.draft)
        }
        .deskBackground()
        .navigationTitle(app.t("Assistent", "Assistant"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if let onClose {
                ToolbarItem(placement: .topBarLeading) {
                    Button(app.t("Fertig", "Done")) { onClose() }
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.pine)
                }
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                if !store.messages.isEmpty {
                    Button(app.t("Neu", "New")) { store.clear() }
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(Theme.pine)
                        .disabled(store.pending)
                }
                modelMenu
            }
        }
        .task(id: app.isConnected) {
            guard app.isConnected else { return }
            await store.prepare()
        }
        .sheet(isPresented: $showModelPicker) {
            AssistantModelPicker()
                .environment(app)
                .environment(store)
        }
        .onChange(of: store.draft) { _, _ in store.saveDraft() }
        .onAppear { inputFocused = true }
    }

    // MARK: - Status and model

    private var statusBar: some View {
        Button {
            showModelPicker = true
        } label: {
            HStack(spacing: 8) {
                if store.pending {
                    ProgressView()
                        .controlSize(.mini)
                        .tint(Theme.pine)
                }
                Text(modelStatus)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer(minLength: 0)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 7)
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(store.pending)
        .accessibilityLabel(app.t("Modell wählen", "Choose model"))
        .accessibilityValue(modelStatus)
    }

    private var modelStatus: String {
        if let model = store.selectedModel {
            let place = model.local ? app.t("lokal", "local") : app.t("extern", "remote")
            let wire = model.protocolName == "anthropic"
                ? app.t("Anthropic-Format", "Anthropic format")
                : model.protocolName == "agy"
                    ? app.t("Antigravity-Format", "Antigravity format")
                    : app.t("OpenAI-Format", "OpenAI format")
            return "\(model.name) · \(place) · \(wire)"
        }
        if let settings = store.settings, settings.configured {
            return "\(settings.model) · \(settings.local ? app.t("lokal", "local") : app.t("extern", "remote"))"
        }
        if store.catalog == nil && !store.catalogFailed {
            return app.t("Modelle werden geladen …", "Loading models …")
        }
        if store.catalogFailed {
            return app.t("Die Modellliste konnte nicht geladen werden.", "The model list could not be loaded.")
        }
        return app.t("Fragen zu Zahlen, Rechnungen und Fristen", "Questions about figures, invoices, and deadlines")
    }

    private var modelMenu: some View {
        Button {
            showModelPicker = true
        } label: {
            Image(systemName: "cpu")
                .foregroundStyle(Theme.pine)
        }
        .accessibilityLabel(app.t("Modell wählen", "Choose model"))
        .disabled(store.pending)
    }

    // MARK: - Transcript

    private var transcript: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    if store.messages.isEmpty && store.streaming == nil {
                        emptyState
                    } else {
                        ForEach(store.messages) { message in
                            AssistantMessageRow(message: message)
                        }
                        if let streaming = store.streaming {
                            AssistantStreamingRow(state: streaming)
                                .id("streaming")
                        }
                    }
                    if !store.error.isEmpty {
                        Text(store.error)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.clay)
                            .fixedSize(horizontal: false, vertical: true)
                            .padding(.top, 4)
                    }
                    if showsSetupHint && !store.messages.isEmpty {
                        setupHint
                    }
                    Color.clear
                        .frame(height: 1)
                        .id("bottom")
                }
                .padding(.horizontal, 14)
                .padding(.top, 12)
                .padding(.bottom, 10)
            }
            .scrollDismissesKeyboard(.interactively)
            .refreshable { await store.refreshModels() }
            .onChange(of: store.messages.count) { _, _ in scrollToBottom(proxy) }
            .onChange(of: store.streaming) { _, _ in scrollToBottom(proxy) }
            .onChange(of: store.error) { _, _ in scrollToBottom(proxy) }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        Task { @MainActor in
            proxy.scrollTo("bottom", anchor: .bottom)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(app.t(
                "Fragen Sie nach Zahlen, Rechnungen oder Fristen. Der Assistent liest die Bücher und kann Vorgänge buchen, die auch die Bildschirme können.",
                "Ask about figures, invoices, or deadlines. The assistant reads the books and can post the operations the screens can post."
            ))
            .font(.system(size: 14))
            .foregroundStyle(Theme.muted)
            .lineSpacing(3)
            .fixedSize(horizontal: false, vertical: true)

            if store.settings?.web == true {
                Text(app.t(
                    "Die Websuche sendet nur die Suchanfrage an eine Suchmaschine und liest öffentliche Seiten. Gefundene Angaben sind Quellen, keine Buchung.",
                    "Web search sends only the query to a search engine and reads public pages. A result is a source, not a posting."
                ))
                .font(.system(size: 11))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
            }

            if showsSetupHint {
                setupHint
            }

            VStack(spacing: 8) {
                quickAction(app.t("Briefing für heute", "Briefing for today")) {
                    app.t("Gib mir ein kurzes Briefing für heute: Bank, offene Rechnungen, Fristen und Aufgaben.", "Give me a short briefing for today: bank, open invoices, deadlines, and tasks.")
                }
                quickAction(app.t("Offene Rechnungen", "Open invoices")) {
                    app.t("Welche Rechnungen sind offen oder überfällig? Nenne Nummer, Kunde, Betrag und Fälligkeit.", "Which invoices are open or overdue? Name the number, customer, amount, and due date.")
                }
                quickAction(app.t("Nächste Fristen", "Next deadlines")) {
                    app.t("Welche Fristen und Aufgaben kommen in den nächsten 30 Tagen?", "Which deadlines and tasks come up in the next 30 days?")
                }
                quickAction(app.t("Monatsabschluss prüfen", "Check the month-end")) {
                    app.t("Prüfe den Monatsabschluss für diesen Monat und nenne die offenen Punkte.", "Check the month-end for this month and name the open points.")
                }
            }
            .padding(.top, 2)
        }
    }

    private var showsSetupHint: Bool {
        guard let settings = store.settings, !settings.configured else { return false }
        if let catalog = store.catalog { return catalog.models.isEmpty }
        return store.catalogFailed
    }

    private var setupHint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.t("Kein Modell eingestellt", "No model configured"))
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.ink)
            Text(app.t(
                "Der Assistent nutzt die lokale opencode-Installation. Fehlt sie, setzen Sie MANAGR_AI_MODEL auf einen OpenAI-kompatiblen Chat-Endpunkt.",
                "The assistant uses the local opencode installation. Without it, set MANAGR_AI_MODEL to an OpenAI-compatible chat endpoint."
            ))
            .font(.system(size: 12))
            .foregroundStyle(Theme.ink)
            .fixedSize(horizontal: false, vertical: true)
            Text("MANAGR_AI_MODEL=qwen2.5:14b\nMANAGR_AI_BASE_URL=http://127.0.0.1:11434/v1\nMANAGR_AI_API_KEY=…")
                .font(.mono(10))
                .foregroundStyle(Theme.ink)
                .padding(8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            Text(app.t(
                "Ein lokales Modell (Ollama oder ein lokaler Server) behält das Gespräch auf diesem Computer. Ein Cloud-Endpunkt erhält Gespräch und Werkzeugergebnisse.",
                "A local model (Ollama or a local server) keeps the conversation on this computer. A cloud endpoint receives the conversation and the tool results."
            ))
            .font(.system(size: 11))
            .foregroundStyle(Theme.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
        .padding(12)
        .background(Theme.amber.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.amber.opacity(0.4), lineWidth: 1))
    }

    private func quickAction(_ title: String, prompt: @escaping () -> String) -> some View {
        Button {
            store.send(prompt())
        } label: {
            HStack {
                Text(title)
                    .font(.system(size: 14))
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 0)
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted)
            }
            .padding(.horizontal, 13)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(store.pending)
    }

    // MARK: - Composer

    private func composer(store draft: Binding<String>) -> some View {
        VStack(spacing: 7) {
            HStack(alignment: .bottom, spacing: 8) {
                TextField(
                    app.t("Was soll ich nachsehen oder buchen?", "What should I look up or post?"),
                    text: draft,
                    axis: .vertical
                )
                .font(.system(size: 14))
                .foregroundStyle(Theme.ink)
                .lineLimit(1...5)
                .focused($inputFocused)
                .submitLabel(.send)
                .onSubmit {
                    let text = draft.wrappedValue
                    store.send(text)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 10)
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Theme.line, lineWidth: 1))

                if store.pending {
                    Button {
                        store.stop()
                    } label: {
                        Image(systemName: "stop.fill")
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .frame(width: 40, height: 40)
                            .background(Theme.clay, in: Circle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(app.t("Stopp", "Stop"))
                } else {
                    Button {
                        let text = draft.wrappedValue
                        store.send(text)
                    } label: {
                        Image(systemName: "arrow.up")
                            .font(.system(size: 16, weight: .semibold))
                            .foregroundStyle(Color.white)
                            .frame(width: 40, height: 40)
                            .background(
                                draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? Theme.muted.opacity(0.35)
                                    : Theme.pine,
                                in: Circle()
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(draft.wrappedValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .accessibilityLabel(app.t("Senden", "Send"))
                }
            }
            Text(app.t(
                "Der Assistent kann buchen. Prüfen Sie die Werkzeugliste unter jeder Antwort und lesen Sie Zahlen am Bildschirm gegen.",
                "The assistant can post. Check the tool list under each answer and compare figures on the screen."
            ))
            .font(.system(size: 10))
            .foregroundStyle(Theme.muted)
            .lineLimit(2)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 13)
        .padding(.top, 9)
        .padding(.bottom, 8)
        .background(Theme.paper)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.line).frame(height: 1)
        }
    }
}

// MARK: - Stored turn

private struct AssistantMessageRow: View {
    @Environment(AppState.self) private var app
    @Environment(AssistantStore.self) private var store
    let message: AssistantChatMessage

    private var isLastUserMessage: Bool {
        message.role == .user && store.messages.last(where: { $0.role == .user })?.id == message.id
    }

    var body: some View {
        VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
            if message.role == .user {
                Text(message.content)
                    .font(.system(size: 14))
                    .foregroundStyle(Color.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 9)
                    .background(Theme.pine, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .frame(maxWidth: 320, alignment: .trailing)
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .textSelection(.enabled)
            } else {
                AssistantTurnParts(plan: message.plan, steps: message.steps, content: message.content, proposal: nil)
                    .padding(11)
                    .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line, lineWidth: 1))
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            if let details = message.details {
                AssistantDetailsView(details: details, role: message.role)
                    .frame(maxWidth: .infinity, alignment: message.role == .user ? .trailing : .leading)
            }
            if isLastUserMessage && !store.pending {
                Button(app.t("Erneut senden", "Retry")) {
                    store.send("", retryOf: message.id)
                }
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.pine)
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }
}

// MARK: - Open turn

private struct AssistantStreamingRow: View {
    @Environment(AppState.self) private var app
    let state: AssistantTurnState

    var body: some View {
        Group {
            if state.steps.isEmpty && state.plan.isEmpty && state.proposal == nil && state.content.isEmpty {
                HStack(spacing: 8) {
                    ProgressView().controlSize(.small).tint(Theme.pine)
                    Text(app.t("Der Assistent liest und rechnet …", "The assistant is reading and calculating …"))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                }
            } else {
                AssistantTurnParts(
                    plan: state.plan.isEmpty ? nil : state.plan,
                    steps: state.steps,
                    content: state.content,
                    proposal: state.proposal
                )
            }
        }
        .padding(11)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Theme.line, lineWidth: 1))
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct AssistantTurnParts: View {
    let plan: [AssistantPlanStepView]?
    let steps: [AssistantChatStep]
    let content: String
    let proposal: AssistantProposal?

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            if let plan, !plan.isEmpty {
                AssistantPlanBar(plan: plan)
            }
            if !steps.isEmpty {
                AssistantStepsView(steps: steps)
            }
            if let proposal {
                AssistantProposalCard(proposal: proposal)
                    .id(proposal.id)
            }
            if !content.isEmpty {
                AssistantMarkdownView(text: content)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Plan

private struct AssistantPlanBar: View {
    @Environment(AppState.self) private var app
    let plan: [AssistantPlanStepView]

    var body: some View {
        let done = plan.filter { $0.status == .done }.count
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(app.t("Roadmap", "Roadmap"))
                    .font(.system(size: 10, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(1)
                    .foregroundStyle(Theme.muted)
                Spacer(minLength: 0)
                Text(app.t("\(done) von \(plan.count) erledigt", "\(done) of \(plan.count) done"))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.muted)
            }
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(plan.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: 8) {
                        VStack(spacing: 0) {
                            statusIcon(step.status)
                                .frame(width: 14, height: 14)
                            if index < plan.count - 1 {
                                Rectangle().fill(Theme.line).frame(width: 1).frame(maxHeight: .infinity)
                            }
                        }
                        VStack(alignment: .leading, spacing: 2) {
                            HStack(alignment: .firstTextBaseline, spacing: 6) {
                                Text(step.title)
                                    .font(.system(size: 12))
                                    .foregroundStyle(step.status == .done || step.status == .skipped ? Theme.muted : Theme.ink)
                                    .strikethrough(step.status == .done)
                                    .fixedSize(horizontal: false, vertical: true)
                                if let change = step.change {
                                    PlanChangeBadge(change: change)
                                }
                            }
                            if let reason = step.note ?? reason(for: step.change) {
                                Text(reason)
                                    .font(.system(size: 11))
                                    .foregroundStyle(Theme.muted)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .padding(.bottom, index < plan.count - 1 ? 10 : 0)
                        Spacer(minLength: 0)
                    }
                }
            }
        }
        .padding(10)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    @ViewBuilder
    private func statusIcon(_ status: AssistantPlanStatus) -> some View {
        switch status {
        case .doing:
            ProgressView().controlSize(.mini).tint(Theme.pine)
        case .done:
            Image(systemName: "checkmark").font(.system(size: 10, weight: .bold)).foregroundStyle(Theme.moss)
        case .skipped:
            Image(systemName: "minus").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.muted)
        case .pending:
            Circle().stroke(Theme.line, lineWidth: 1).frame(width: 9, height: 9)
        }
    }

    private func reason(for change: AssistantPlanChange?) -> String? {
        switch change {
        case .added: return app.t("Neu aufgenommen", "Added")
        case .changed: return app.t("Angepasst", "Changed")
        case .removed: return app.t("Aus dem Plan entfernt", "Removed from the plan")
        case nil: return nil
        }
    }
}

private struct PlanChangeBadge: View {
    @Environment(AppState.self) private var app
    let change: AssistantPlanChange

    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(tint.opacity(0.13), in: Capsule())
    }

    private var label: String {
        switch change {
        case .added: return app.t("Neu", "Added")
        case .changed: return app.t("Geändert", "Changed")
        case .removed: return app.t("Entfernt", "Removed")
        }
    }

    private var tint: Color {
        switch change {
        case .added: return Theme.moss
        case .changed: return Theme.amber
        case .removed: return Theme.clay
        }
    }
}

// MARK: - Tool calls

private struct AssistantStepGroup: Identifiable {
    let key: String
    let name: String
    var steps: [AssistantChatStep]
    var id: String { key }
}

private struct AssistantStepsView: View {
    @Environment(AppState.self) private var app
    let steps: [AssistantChatStep]
    @State private var openGroups: Set<String> = []

    private var groups: [AssistantStepGroup] {
        var result: [AssistantStepGroup] = []
        var byName: [String: Int] = [:]
        for step in steps {
            if let index = byName[step.name] {
                result[index].steps.append(step)
            } else {
                byName[step.name] = result.count
                result.append(AssistantStepGroup(key: step.key, name: step.name, steps: [step]))
            }
        }
        return result
    }

    var body: some View {
        VStack(spacing: 5) {
            ForEach(groups) { group in
                let open = openGroups.contains(group.key)
                VStack(alignment: .leading, spacing: 6) {
                    Button {
                        if open {
                            openGroups.remove(group.key)
                        } else {
                            openGroups.insert(group.key)
                        }
                    } label: {
                        HStack(spacing: 6) {
                            statusIcon(groupStatus(group.steps))
                            Text(AssistantLabels.tool(group.name, app))
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(group.steps.contains { $0.status == .error } ? Theme.clay : Theme.ink)
                                .lineLimit(1)
                            if AssistantWrite.changesData(group.name) {
                                AssistantActionBadge(action: AssistantWrite.action(name: group.name, input: group.steps.last?.input ?? .null))
                            }
                            if group.steps.count > 1 {
                                Text("\(group.steps.count)")
                                    .font(.mono(9))
                                    .foregroundStyle(Theme.muted)
                                    .padding(.horizontal, 4)
                                    .background(Theme.ink.opacity(0.06), in: Capsule())
                            }
                            Spacer(minLength: 0)
                            Image(systemName: open ? "chevron.up" : "chevron.down")
                                .font(.system(size: 9, weight: .semibold))
                                .foregroundStyle(Theme.muted)
                        }
                        .padding(.horizontal, 8)
                        .padding(.vertical, 7)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)

                    if open {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(Array(group.steps.enumerated()), id: \.element.id) { index, step in
                                AssistantStepDetail(step: step, index: index + 1, total: group.steps.count)
                                if index < group.steps.count - 1 {
                                    Divider().overlay(Theme.line)
                                }
                            }
                        }
                        .padding(.horizontal, 8)
                        .padding(.bottom, 8)
                    }
                }
                .background(Theme.card, in: RoundedRectangle(cornerRadius: 11, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 11, style: .continuous).stroke(Theme.line, lineWidth: 1))
            }
        }
    }

    private func groupStatus(_ steps: [AssistantChatStep]) -> AssistantStepStatus {
        if steps.contains(where: { $0.status == .running }) { return .running }
        if steps.contains(where: { $0.status == .error }) { return .error }
        return .ok
    }

    @ViewBuilder
    private func statusIcon(_ status: AssistantStepStatus) -> some View {
        switch status {
        case .running:
            ProgressView().controlSize(.mini).tint(Theme.pine)
        case .ok:
            Image(systemName: "checkmark").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.moss)
        case .error:
            Image(systemName: "xmark").font(.system(size: 9, weight: .bold)).foregroundStyle(Theme.clay)
        }
    }
}

private struct AssistantStepDetail: View {
    @Environment(AppState.self) private var app
    let step: AssistantChatStep
    let index: Int
    let total: Int

    private var truncated: Bool {
        step.data?.objectValue?["truncated"]?.boolValue == true
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 6) {
                Image(systemName: step.status == .error ? "xmark" : step.status == .ok ? "checkmark" : "clock")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(step.status == .error ? Theme.clay : step.status == .ok ? Theme.moss : Theme.muted)
                Text(AssistantLabels.tool(step.name, app))
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.ink)
                if total > 1 {
                    Text(app.t("Aufruf \(index) von \(total)", "Call \(index) of \(total)"))
                        .font(.system(size: 9))
                        .foregroundStyle(Theme.muted)
                }
                Spacer(minLength: 0)
            }

            if !step.input.isEmpty {
                json(step.input.prettyPrinted, maxHeight: 132)
            } else {
                Text(app.t("Ohne Parameter", "No parameters"))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.muted)
            }

            Text(step.status == .error
                 ? app.t("Fehlgeschlagen", "Failed")
                 : AssistantWrite.changesData(step.name) ? app.t("Ergebnis", "Result") : app.t("Gelesen", "Read"))
                .font(.system(size: 9, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundStyle(Theme.muted)

            if step.status == .error {
                Text(step.summary.isEmpty ? app.t("Fehlgeschlagen", "Failed") : step.summary)
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.clay)
                    .fixedSize(horizontal: false, vertical: true)
            } else if step.data == nil {
                Text(step.status == .running ? app.t("Läuft …", "Running …") : app.t("Kein Ergebnis", "No result"))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.muted)
            } else if truncated {
                Text(app.t(
                    "Der Inhalt ist zu groß für die Anzeige. Der Assistent hat ihn vollständig gelesen.",
                    "The content is too large to show. The assistant read all of it."
                ))
                .font(.system(size: 10))
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
            } else if let data = step.data {
                json(data.prettyPrinted, maxHeight: 170)
            }
        }
    }

    private func json(_ text: String, maxHeight: CGFloat) -> some View {
        ScrollView([.horizontal, .vertical]) {
            Text(text)
                .font(.mono(9))
                .foregroundStyle(Theme.ink)
                .padding(6)
                .frame(maxWidth: .infinity, alignment: .leading)
                .textSelection(.enabled)
        }
        .frame(maxHeight: maxHeight)
        .background(Theme.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
    }
}

private struct AssistantActionBadge: View {
    @Environment(AppState.self) private var app
    let action: AssistantChangeAction

    var body: some View {
        Text(label)
            .font(.system(size: 9, weight: .semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .background(tint.opacity(0.13), in: Capsule())
    }

    private var label: String {
        switch action {
        case .add: return app.t("Hinzufügen", "Add")
        case .update: return app.t("Aktualisieren", "Update")
        case .delete: return app.t("Löschen", "Delete")
        }
    }

    private var tint: Color {
        switch action {
        case .add: return Theme.moss
        case .update: return Theme.amber
        case .delete: return Theme.clay
        }
    }
}

// MARK: - Confirmation card

private struct AssistantProposalCard: View {
    @Environment(AppState.self) private var app
    @Environment(AssistantStore.self) private var store
    let proposal: AssistantProposal

    @State private var selected: Set<String> = []
    @State private var busy = false
    @State private var sent = false
    @State private var error = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(proposal.changes.count == 1
                 ? app.t("1 Änderung zur Bestätigung", "1 change to confirm")
                 : app.t("\(proposal.changes.count) Änderungen zur Bestätigung", "\(proposal.changes.count) changes to confirm"))
                .font(.system(size: 10, weight: .semibold))
                .textCase(.uppercase)
                .tracking(1)
                .foregroundStyle(Theme.amber)

            Text(app.t(
                "Prüfe, was hinzugefügt, aktualisiert oder gelöscht wird. Entferne ein Häkchen, um eine Änderung abzulehnen. Erst nach deiner Bestätigung wird etwas ausgeführt.",
                "Check what will be added, updated, or deleted. Clear a check to reject a change. Nothing runs before your confirmation."
            ))
            .font(.system(size: 11))
            .foregroundStyle(Theme.muted)
            .fixedSize(horizontal: false, vertical: true)

            VStack(spacing: 6) {
                ForEach(proposal.changes) { change in
                    changeRow(change)
                }
            }

            if !sent {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Button {
                            submit(proposal.changes.map(\.callId))
                        } label: {
                            Text(app.t("Alle übernehmen", "Approve all"))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Color.white)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
                                .background(Theme.pine, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)

                        Button {
                            submit([])
                        } label: {
                            Text(app.t("Alle ablehnen", "Reject all"))
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(Theme.clay)
                                .padding(.horizontal, 11)
                                .padding(.vertical, 7)
                                .background(Theme.clay.opacity(0.10), in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(busy)
                    }

                    Button {
                        submit(Array(selected))
                    } label: {
                        Text(app.t("Auswahl übernehmen (\(selected.count))", "Approve selected (\(selected.count))"))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Theme.pine)
                    }
                    .buttonStyle(.plain)
                    .disabled(busy || selected.isEmpty)

                    Text(app.t(
                        "\(selected.count) von \(proposal.changes.count) ausgewählt",
                        "\(selected.count) of \(proposal.changes.count) selected"
                    ))
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.muted)
                }
            }

            if busy || sent {
                HStack(spacing: 6) {
                    ProgressView().controlSize(.mini).tint(Theme.pine)
                    Text(app.t("Wird ausgeführt …", "Applying …"))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                }
            }
            if !error.isEmpty {
                Text(error)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.clay)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(11)
        .background(Theme.amber.opacity(0.06), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Theme.amber.opacity(0.4), lineWidth: 1))
        .onAppear {
            if selected.isEmpty {
                selected = Set(proposal.changes.map(\.callId))
            }
        }
    }

    private func changeRow(_ change: AssistantProposalChange) -> some View {
        let fields = change.input.objectValue?.filter { !$0.value.isEmpty } ?? [:]
        let isOn = selected.contains(change.callId)
        return VStack(alignment: .leading, spacing: 5) {
            Button {
                guard !busy && !sent else { return }
                if isOn { selected.remove(change.callId) } else { selected.insert(change.callId) }
            } label: {
                HStack(alignment: .top, spacing: 7) {
                    Image(systemName: isOn ? "checkmark.square.fill" : "square")
                        .font(.system(size: 15))
                        .foregroundStyle(isOn ? Theme.pine : Theme.muted)
                    VStack(alignment: .leading, spacing: 3) {
                        HStack(spacing: 5) {
                            AssistantActionBadge(action: change.action)
                            Text(AssistantLabels.tool(change.name, app))
                                .font(.system(size: 12, weight: .medium))
                                .foregroundStyle(Theme.ink)
                        }
                        if !fields.isEmpty {
                            VStack(alignment: .leading, spacing: 1) {
                                ForEach(fields.keys.sorted(), id: \.self) { key in
                                    HStack(alignment: .top, spacing: 6) {
                                        Text(AssistantLabels.field(key, app))
                                            .font(.system(size: 10))
                                            .foregroundStyle(Theme.muted)
                                            .frame(width: 96, alignment: .leading)
                                        Text(change.labels?[key] ?? AssistantLabels.fieldValue(key, value: fields[key] ?? .null, app))
                                            .font(.system(size: 11))
                                            .foregroundStyle(Theme.ink)
                                            .lineLimit(2)
                                    }
                                }
                            }
                        }
                    }
                    Spacer(minLength: 0)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            DisclosureGroup {
                Text(change.input.prettyPrinted)
                    .font(.mono(9))
                    .foregroundStyle(Theme.ink)
                    .padding(6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.ink.opacity(0.05), in: RoundedRectangle(cornerRadius: 7, style: .continuous))
            } label: {
                Text(app.t("Rohdaten", "Raw data"))
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.muted)
            }
        }
        .padding(8)
        .background(Color.white, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).stroke(Theme.line, lineWidth: 1))
    }

    private func submit(_ approved: [String]) {
        guard !busy, !sent else { return }
        busy = true
        error = ""
        Task {
            let message = await store.decide(proposal: proposal, approved: approved)
            if let message {
                error = message
            } else {
                sent = true
            }
            busy = false
        }
    }
}

// MARK: - Details

private struct AssistantDetailsView: View {
    @Environment(AppState.self) private var app
    let details: AssistantChatDetails
    let role: AssistantRole

    private var summary: String {
        var parts: [String] = [details.at.assistantStamp(locale: app.locale)]
        if let duration = details.durationMs {
            let seconds = Double(duration) / 1000
            let text = String(format: "%.1f", seconds)
            parts.append("\(app.locale == .de ? text.replacingOccurrences(of: ".", with: ",") : text) s")
        }
        parts.append(app.t("Details", "Details"))
        return parts.joined(separator: " · ")
    }

    private var rows: [(String, String)] {
        var rows: [(String, String)] = []
        if let model = details.model { rows.append((app.t("Modell", "Model"), model)) }
        if let provider = details.provider { rows.append((app.t("Anbieter", "Provider"), provider)) }
        if let wire = details.protocolName {
            let label = wire == "anthropic"
                ? app.t("Anthropic-Format", "Anthropic format")
                : wire == "agy"
                    ? app.t("Antigravity-Format", "Antigravity format")
                    : app.t("OpenAI-Format", "OpenAI format")
            rows.append((app.t("Protokoll", "Protocol"), label))
        }
        if let baseUrl = details.baseUrl {
            rows.append((app.t("Endpunkt", "Endpoint"), "\(baseUrl) · \(details.local == true ? app.t("lokal", "local") : app.t("extern", "remote"))"))
        }
        rows.append((app.t("MCP-Server", "MCP server"), details.mcpServer ?? "managr-mcp"))
        if role == .assistant, let tools = details.toolCalls {
            rows.append((app.t("Werkzeuge", "Tools"), app.t("\(tools) Aufrufe", "\(tools) calls")))
        }
        if role == .assistant, let status = details.status {
            let text = status == .ok ? app.t("OK", "OK") : status == .error ? app.t("Fehler", "Error") : app.t("Abgebrochen", "Stopped")
            rows.append((app.t("Status", "Status"), text))
        }
        if let retries = details.retries, retries > 0 {
            rows.append((app.t("Erneut gesendet", "Retried"), "\(retries)×"))
            if let last = details.lastRetryAt {
                rows.append((app.t("Zuletzt", "Last"), last.assistantStamp(locale: app.locale)))
            }
        }
        return rows
    }

    var body: some View {
        DisclosureGroup {
            VStack(alignment: .leading, spacing: 3) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    HStack(alignment: .top, spacing: 8) {
                        Text(row.0)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.muted)
                            .frame(width: 82, alignment: .leading)
                        Text(row.1)
                            .font(.system(size: 10))
                            .foregroundStyle(Theme.ink.opacity(0.8))
                            .lineLimit(2)
                        Spacer(minLength: 0)
                    }
                }
            }
            .padding(.top, 3)
        } label: {
            Text(summary)
                .font(.system(size: 10))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: 340, alignment: role == .user ? .trailing : .leading)
    }
}

// MARK: - Labels

/// The German and English tool names the desk uses, with a readable fallback.
@MainActor
enum AssistantLabels {
    static func tool(_ name: String, _ app: AppState) -> String {
        if let entry = tools[name] {
            return app.locale == .de ? entry.de : entry.en
        }
        return name
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "read ", with: app.t("lesen: ", "read "))
    }

    static func field(_ key: String, _ app: AppState) -> String {
        if let entry = fields[key] {
            return app.locale == .de ? entry.de : entry.en
        }
        let spaced = key.replacingOccurrences(of: "([a-z0-9])([A-Z])", with: "$1 $2", options: .regularExpression)
        return String(spaced.prefix(1)).uppercased() + String(spaced.dropFirst())
    }

    static func fieldValue(_ key: String, value: JSONValue, _ app: AppState) -> String {
        switch value {
        case .null: return app.t("leer", "empty")
        case .bool(let flag): return flag ? app.t("Ja", "Yes") : app.t("Nein", "No")
        case .int(let number):
            if key == "vatBps" || key == "shareBps" || key == "progressBps" {
                return Format.vatLabel(number)
            }
            if key.hasSuffix("Id") { return "#\(number)" }
            if key == "breakMinutes" { return "\(number) min" }
            if moneyFields.contains(key) { return "\(number) €" }
            return String(number)
        case .double(let number):
            return String(number)
        case .string(let text):
            return moneyFields.contains(key) ? "\(text) €" : text
        case .array(let items):
            if key == "lines" { return app.t("\(items.count) Positionen", "\(items.count) lines") }
            return app.t("\(items.count) Einträge", "\(items.count) entries")
        case .object:
            return value.prettyPrinted
        }
    }

    private static let moneyFields: Set<String> = ["amount", "nominal", "grossMonthly", "unitNet", "monthlyPremium"]

    private static let fields: [String: (de: String, en: String)] = [
        "id": ("Datensatz", "Record"),
        "companyId": ("Unternehmen", "Company"),
        "customerId": ("Kunde", "Customer"),
        "invoiceId": ("Rechnung", "Invoice"),
        "personId": ("Person", "Person"),
        "projectId": ("Projekt", "Project"),
        "taskId": ("Aufgabe", "Task"),
        "shareholderId": ("Gesellschafter", "Shareholder"),
        "entryDate": ("Datum", "Date"),
        "startedAt": ("Von", "From"),
        "endedAt": ("Bis", "To"),
        "breakMinutes": ("Pause", "Break"),
        "memo": ("Vermerk", "Note"),
        "taskType": ("Tätigkeit", "Task type"),
        "billable": ("Abrechenbar", "Billable"),
        "issueDate": ("Rechnungsdatum", "Issue date"),
        "serviceDate": ("Leistungsdatum", "Service date"),
        "dueDate": ("Fällig", "Due"),
        "paymentDate": ("Zahlungsdatum", "Payment date"),
        "buyerReference": ("Käuferreferenz", "Buyer reference"),
        "lines": ("Positionen", "Lines"),
        "description": ("Bezeichnung", "Description"),
        "quantity": ("Menge", "Quantity"),
        "unitNet": ("Einzelpreis netto", "Unit price net"),
        "vatBps": ("Umsatzsteuer", "VAT"),
        "amount": ("Betrag", "Amount"),
        "date": ("Datum", "Date"),
        "name": ("Name", "Name"),
        "email": ("E-Mail", "Email"),
        "vatId": ("USt-IdNr.", "VAT id"),
        "street": ("Straße", "Street"),
        "postalCode": ("PLZ", "Postal code"),
        "city": ("Ort", "City"),
        "country": ("Land", "Country"),
        "kind": ("Art", "Kind"),
        "status": ("Status", "Status"),
        "title": ("Titel", "Title"),
        "notes": ("Notizen", "Notes"),
        "note": ("Notiz", "Note"),
        "category": ("Kategorie", "Category"),
        "recurrence": ("Wiederholung", "Recurrence"),
        "label": ("Bezeichnung", "Label"),
        "provider": ("Anbieter", "Provider"),
        "policyNumber": ("Police", "Policy"),
        "monthlyPremium": ("Monatsbeitrag", "Monthly premium"),
        "renewalDate": ("Verlängerung", "Renewal"),
        "shareBps": ("Anteil", "Share"),
        "nominal": ("Nominal", "Nominal"),
        "grossMonthly": ("Gehalt monatlich", "Monthly gross"),
        "validFrom": ("Gültig ab", "Valid from"),
        "startDate": ("Von", "From"),
        "endDate": ("Bis", "To"),
        "year": ("Jahr", "Year"),
        "month": ("Monat", "Month"),
        "progressBps": ("Fortschritt", "Progress"),
        "targetDate": ("Ziel", "Target date"),
        "reason": ("Grund", "Reason"),
    ]

    private static let tools: [String: (de: String, en: String)] = [
        "read_companies": ("Unternehmen lesen", "Read companies"),
        "read_desk": ("Übersicht lesen", "Read the overview"),
        "read_company": ("Gesellschaft lesen", "Read the company"),
        "read_customers": ("Kunden lesen", "Read customers"),
        "read_contacts": ("Kontaktpersonen lesen", "Read contact people"),
        "read_invoices": ("Rechnungen lesen", "Read invoices"),
        "read_invoice": ("Rechnung lesen", "Read the invoice"),
        "check_xrechnung": ("XRechnung prüfen", "Check the XRechnung"),
        "read_ledger": ("Bücher lesen", "Read the books"),
        "read_people": ("Personen lesen", "Read people"),
        "read_person": ("Person lesen", "Read the person"),
        "read_time": ("Zeiten lesen", "Read time"),
        "read_tasks": ("Aufgaben lesen", "Read tasks"),
        "read_obligations": ("Pflichten lesen", "Read obligations"),
        "read_documents": ("Dokumente lesen", "Read documents"),
        "read_legal": ("Recht lesen", "Read legal"),
        "read_projects": ("Projekte lesen", "Read projects"),
        "read_analytics": ("Auswertung lesen", "Read analysis"),
        "save_project": ("Projekt speichern", "Save project"),
        "delete_project": ("Projekt entfernen", "Remove project"),
        "switch_company": ("Unternehmen wechseln", "Switch company"),
        "create_company": ("Unternehmen anlegen", "Create a company"),
        "update_company_identity": ("Stammdaten speichern", "Save company particulars"),
        "update_tax_profile": ("Steuerprofil speichern", "Save the tax profile"),
        "update_bank": ("Bankdaten speichern", "Save bank details"),
        "read_shareholder_loans": ("Gesellschafterdarlehen lesen", "Read shareholder loans"),
        "add_shareholder_loan": ("Gesellschafterdarlehen aufnehmen", "Take up a shareholder loan"),
        "record_shareholder_loan_movement": ("Darlehensvorgang buchen", "Post a loan movement"),
        "save_founder_health": ("Krankenversicherung des Gründers speichern", "Save founder health cover"),
        "delete_founder_health": ("Krankenversicherung des Gründers entfernen", "Remove founder health cover"),
        "save_director_contract": ("Geschäftsführervertrag speichern", "Save a managing-director contract"),
        "delete_director_contract": ("Geschäftsführervertrag entfernen", "Remove a managing-director contract"),
        "add_shareholder": ("Gesellschafter aufnehmen", "Add a shareholder"),
        "delete_shareholder": ("Gesellschafter entfernen", "Remove a shareholder"),
        "record_reserve_allocation": ("Rücklage einstellen", "Allocate the reserve"),
        "offset_reserve": ("Rücklage ausgleichen", "Offset the reserve"),
        "add_policy": ("Versicherung hinzufügen", "Add a policy"),
        "delete_policy": ("Versicherung entfernen", "Remove a policy"),
        "pay_profit_distribution": ("Gewinn ausschütten", "Pay a profit distribution"),
        "save_customer": ("Kunde speichern", "Save the customer"),
        "save_contact": ("Kontaktperson speichern", "Save the contact person"),
        "delete_contact": ("Kontaktperson entfernen", "Remove the contact person"),
        "create_invoice": ("Rechnung anlegen", "Create an invoice"),
        "issue_invoice": ("Rechnung stellen", "Issue the invoice"),
        "update_buyer_reference": ("Käuferreferenz speichern", "Save the buyer reference"),
        "record_invoice_payment": ("Zahlung buchen", "Record the payment"),
        "void_invoice": ("Rechnung stornieren", "Void the invoice"),
        "delete_invoice_draft": ("Entwurf löschen", "Delete the draft"),
        "post_expense": ("Aufwand buchen", "Post an expense"),
        "post_vat_prepayment": ("Vorauszahlung buchen", "Post a VAT prepayment"),
        "post_journal_entry": ("Buchung speichern", "Post a journal entry"),
        "create_person": ("Person anlegen", "Add a person"),
        "update_person": ("Person speichern", "Save the person"),
        "add_salary_change": ("Gehaltsänderung speichern", "Save a salary change"),
        "add_absence": ("Abwesenheit eintragen", "Record an absence"),
        "delete_absence": ("Abwesenheit entfernen", "Remove an absence"),
        "post_payroll": ("Lohn buchen", "Post payroll"),
        "pay_shareholder": ("Auszahlung buchen", "Post a shareholder payout"),
        "add_time": ("Zeit eintragen", "Record time"),
        "update_plan": ("Roadmap aktualisieren", "Update the roadmap"),
        "update_time": ("Zeit aktualisieren", "Update time"),
        "delete_time": ("Zeit entfernen", "Remove time"),
        "add_task": ("Aufgabe anlegen", "Add a task"),
        "set_task_status": ("Aufgabe aktualisieren", "Update the task"),
        "delete_task": ("Aufgabe entfernen", "Remove the task"),
        "set_obligation": ("Pflicht aktualisieren", "Update the obligation"),
        "add_deadline": ("Frist anlegen", "Add a deadline"),
        "complete_deadline": ("Frist erledigen", "Complete the deadline"),
        "delete_deadline": ("Frist entfernen", "Remove the deadline"),
        "set_compliance_done": ("Checkliste aktualisieren", "Update the checklist"),
        "save_resolution": ("Beschluss festhalten", "Record a resolution"),
        "daily_briefing": ("Briefing erstellen", "Build the briefing"),
        "vat_overview": ("Umsatzsteuer prüfen", "Check VAT"),
        "monthly_close_checklist": ("Monatsabschluss prüfen", "Check the month-end"),
        "draft_dunning_letter": ("Zahlungserinnerung entwerfen", "Draft a payment reminder"),
        "web_search": ("Im Web suchen", "Search the web"),
        "web_fetch": ("Webseite lesen", "Read a web page"),
    ]
}