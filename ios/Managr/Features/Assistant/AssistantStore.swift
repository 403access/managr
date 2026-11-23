import Foundation
import Observation

/// Owns the chat, the open stream, and the model choice for the whole app.
/// The store sits above the screens, so opening another tab does not cancel a
/// running turn; only Stop, a new chat, or reconnecting ends it.
@MainActor
@Observable
final class AssistantStore {
    @ObservationIgnored weak var app: AppState?

    var messages: [AssistantChatMessage] = []
    var streaming: AssistantTurnState?
    var error = ""
    var settings: AssistantSettings?
    var catalog: AssistantCatalog?
    var selection: AssistantSelection?
    var draft = ""
    /// Set when the catalog request failed, so the UI stops claiming to load.
    var catalogFailed = false

    var pending: Bool { streaming != nil }

    @ObservationIgnored private var streamTask: Task<Void, Never>?
    @ObservationIgnored private var preparedFor: String?
    @ObservationIgnored private var generation = 0
    @ObservationIgnored private var nextId = 1
    @ObservationIgnored private var chatKey = ""
    @ObservationIgnored private var draftKey = ""
    @ObservationIgnored private let defaults = UserDefaults.standard

    private static let modelKey = "managr.assistant.model"
    private static let version = 1
    private static let maxMessages = 40

    // MARK: - Setup

    /// Loads the saved conversation and the model list once per desk.
    func prepare() async {
        guard let app, let client = app.client else { return }
        let key = app.serverDisplay
        if preparedFor == key { return }
        if preparedFor != nil {
            // A different desk: the old stream and its conversation belong to it.
            generation += 1
            streamTask?.cancel()
            streamTask = nil
            streaming = nil
            messages = []
            nextId = 1
            error = ""
        }
        preparedFor = key
        chatKey = "managr.assistant.chat.\(key)"
        draftKey = "managr.assistant.draft.\(key)"
        catalogFailed = false
        loadChat()
        draft = defaults.string(forKey: draftKey) ?? ""

        async let settingsResult = try? client.assistantSettings()
        async let catalogResult = try? client.assistantCatalog()
        let (loadedSettings, loadedCatalog) = await (settingsResult, catalogResult)

        if let loadedSettings { settings = loadedSettings }
        if let loadedCatalog {
            catalog = loadedCatalog
            resolveSelection()
        } else {
            catalogFailed = true
        }
    }

    /// Re-reads settings and the model list, for a model configured while the
    /// app is open. The conversation is untouched.
    func refreshModels() async {
        guard let client = app?.client else { return }
        catalogFailed = false
        if let loaded = try? await client.assistantSettings() {
            settings = loaded
        }
        if let loaded = try? await client.assistantCatalog() {
            catalog = loaded
            resolveSelection()
        } else {
            catalogFailed = true
        }
    }

    /// Shown after the desk was replaced or disconnected and reconnected.
    func resetForNewDesk() {
        preparedFor = nil
        generation += 1
        messages = []
        streaming = nil
        streamTask?.cancel()
        streamTask = nil
        error = ""
        settings = nil
        catalog = nil
        selection = nil
        draft = ""
    }

    // MARK: - Model choice

    func choose(_ model: AssistantModelInfo) {
        let next = AssistantSelection(providerID: model.providerID, modelID: model.modelID)
        selection = next
        if let data = try? JSONEncoder().encode(next) {
            defaults.set(data, forKey: Self.modelKey)
        }
    }

    private func resolveSelection() {
        guard let catalog else { return }
        let valid: (AssistantSelection?) -> AssistantSelection? = { candidate in
            guard let candidate,
                  catalog.models.contains(where: { $0.providerID == candidate.providerID && $0.modelID == candidate.modelID })
            else { return nil }
            return candidate
        }
        if valid(selection) != nil { return }
        let stored: AssistantSelection? = defaults.data(forKey: Self.modelKey).flatMap {
            try? JSONDecoder().decode(AssistantSelection.self, from: $0)
        }
        let next = valid(stored) ?? valid(catalog.defaultSelection) ?? catalog.models.first.map {
            AssistantSelection(providerID: $0.providerID, modelID: $0.modelID)
        }
        if let next {
            selection = next
            if let data = try? JSONEncoder().encode(next) {
                defaults.set(data, forKey: Self.modelKey)
            }
        } else {
            selection = nil
        }
    }

    var selectedModel: AssistantModelInfo? {
        guard let selection, let catalog else { return nil }
        return catalog.models.first { $0.providerID == selection.providerID && $0.modelID == selection.modelID }
    }

    // MARK: - Sending

    func send(_ raw: String, retryOf: Int? = nil) {
        guard !pending, let app, let client = app.client else { return }
        let content = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if retryOf == nil && content.isEmpty { return }

        let startedAt = Date()
        let promptModel = selectedModel
        var history: [AssistantChatMessage]
        var retryBackup: [AssistantChatMessage] = []

        if let retryOf {
            guard let index = messages.lastIndex(where: { $0.id == retryOf && $0.role == .user }) else { return }
            let target = messages[index]
            retryBackup = Array(messages[(index + 1)...])
            var details = target.details ?? AssistantChatDetails(at: startedAt)
            details.retries = (details.retries ?? 0) + 1
            details.lastRetryAt = startedAt
            let updated = AssistantChatMessage(
                id: target.id,
                role: target.role,
                content: target.content,
                steps: target.steps,
                details: details,
                plan: target.plan
            )
            history = Array(messages[0...index])
            history[index] = updated
            messages = history
            persistChat()
        } else {
            let question = AssistantChatMessage(
                id: nextId,
                role: .user,
                content: content,
                steps: [],
                details: AssistantChatDetails(
                    at: startedAt,
                    model: promptModel?.name ?? (settings?.model.isEmpty == false ? settings?.model : nil),
                    provider: promptModel?.providerName,
                    protocolName: promptModel?.protocolName,
                    local: promptModel?.local ?? settings?.local,
                    mcpServer: "managr-mcp"
                ),
                plan: nil
            )
            nextId += 1
            history = messages + [question]
            messages = history
            draft = ""
            saveDraft()
            persistChat()
        }

        error = ""
        generation += 1
        let run = generation
        streaming = AssistantTurnState()
        let turns = history
            .filter { $0.role == .user || !$0.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
            .suffix(Self.maxMessages)
            .map { AssistantTurnInput(role: $0.role.rawValue, content: $0.content) }
        let selection = self.selection
        let selectionSnapshot = selection

        streamTask = Task { [weak self] in
            guard let self else { return }
            var requestError = ""
            do {
                let events = try await client.assistantEvents(messages: Array(turns), selection: selectionSnapshot)
                for try await event in events {
                    if Task.isCancelled || run != self.generation { break }
                    self.apply(event)
                }
                if let state = self.streaming,
                   !state.sawReply,
                   state.content.isEmpty,
                   state.steps.isEmpty,
                   state.error.isEmpty {
                    requestError = self.app?.t("Der Assistent konnte nicht antworten. Läuft der Modell-Endpunkt?", "The assistant could not answer. Is the model endpoint running?") ?? "The assistant failed."
                }
            } catch {
                if let api = error as? AssistantAPIError {
                    requestError = api.message
                    if api.notConfigured {
                        self.settings = AssistantSettings(
                            configured: false,
                            model: api.model ?? "",
                            baseUrl: api.baseUrl ?? "",
                            local: true,
                            web: self.settings?.web
                        )
                    }
                } else if !Task.isCancelled {
                    requestError = self.friendly(error)
                }
            }

            guard run == self.generation else { return }
            let stopped = Task.isCancelled
            let state = self.streaming ?? AssistantTurnState()
            let answer = state.content
            let steps = state.steps
            let plan = state.plan
            let modelInfo = state.model
            let streamError = state.error
            let errorText = streamError.isEmpty ? requestError : streamError

            if !answer.isEmpty || !steps.isEmpty {
                let providerName: String? = modelInfo?.providerID.flatMap { providerID in
                    self.catalog?.models.first {
                        $0.providerID == providerID && $0.modelID == (modelInfo?.modelID ?? "")
                    }?.providerName
                } ?? promptModel?.providerName
                let details = AssistantChatDetails(
                    at: Date(),
                    durationMs: Int(Date().timeIntervalSince(startedAt) * 1000),
                    model: modelInfo?.model ?? promptModel?.name ?? (self.settings?.model.isEmpty == false ? self.settings?.model : nil),
                    provider: providerName,
                    protocolName: modelInfo?.protocolName ?? promptModel?.protocolName,
                    baseUrl: modelInfo?.baseUrl,
                    local: modelInfo?.local ?? promptModel?.local ?? self.settings?.local,
                    mcpServer: "managr-mcp",
                    toolCalls: steps.count,
                    status: stopped ? .stopped : (errorText.isEmpty ? .ok : .error)
                )
                self.messages.append(
                    AssistantChatMessage(
                        id: self.nextId,
                        role: .assistant,
                        content: answer,
                        steps: steps,
                        details: details,
                        plan: plan.isEmpty ? nil : plan
                    )
                )
                self.nextId += 1
            } else if !retryBackup.isEmpty {
                self.messages.append(contentsOf: retryBackup)
            }

            self.streaming = nil
            self.streamTask = nil
            if !errorText.isEmpty {
                self.error = errorText
            }
            self.persistChat()
            _ = app
        }
    }

    func stop() {
        streamTask?.cancel()
    }

    func clear() {
        guard !pending else { return }
        messages = []
        error = ""
        nextId = 1
        persistChat()
    }

    /// Sends a decision for the confirmation card of the running turn.
    /// Returns an error message when the approval could not be delivered.
    func decide(proposal: AssistantProposal, approved: [String]) async -> String? {
        guard let client = app?.client else { return "The desk is not connected." }
        do {
            try await client.assistantApprove(id: proposal.id, approved: approved)
            return nil
        } catch let api as AssistantAPIError {
            if api.status == 404 {
                return app?.t("Die Bestätigung ist abgelaufen. Bitte frage erneut.", "The confirmation expired. Please ask again.") ?? api.message
            }
            return api.message
        } catch {
            return app?.t("Die Bestätigung konnte nicht gesendet werden.", "The confirmation could not be sent.") ?? friendly(error)
        }
    }

    private func apply(_ event: AssistantStreamEvent) {
        let state = AssistantReplay.apply(streaming ?? AssistantTurnState(), event)
        streaming = state

        if case .model(let model, let baseUrl, let local, _, _, _) = event {
            settings = AssistantSettings(
                configured: true,
                model: model,
                baseUrl: baseUrl,
                local: local,
                web: settings?.web
            )
        }
        if case .toolResult(let name, _, true, _, _) = event, AssistantWrite.changesData(name) {
            app?.didChange()
        }
    }

    private func friendly(_ error: Error) -> String {
        if let api = error as? AssistantAPIError { return api.message }
        if let app { return app.friendly(error) }
        return error.localizedDescription
    }

    // MARK: - Persistence

    private struct StoredChat: Codable {
        let version: Int
        let messages: [AssistantChatMessage]
    }

    private func loadChat() {
        guard !chatKey.isEmpty else { return }
        guard let data = defaults.data(forKey: chatKey),
              let stored = try? JSONDecoder().decode(StoredChat.self, from: data),
              stored.version == Self.version
        else {
            messages = []
            nextId = 1
            return
        }
        messages = Array(stored.messages.suffix(Self.maxMessages))
        nextId = (messages.map(\.id).max() ?? 0) + 1
    }

    private func persistChat() {
        guard !chatKey.isEmpty else { return }
        if messages.isEmpty {
            defaults.removeObject(forKey: chatKey)
            return
        }
        let stored = StoredChat(version: Self.version, messages: Array(messages.suffix(Self.maxMessages)))
        if let data = try? JSONEncoder().encode(stored) {
            defaults.set(data, forKey: chatKey)
        }
    }

    func saveDraft() {
        guard !draftKey.isEmpty else { return }
        if draft.isEmpty {
            defaults.removeObject(forKey: draftKey)
        } else {
            defaults.set(draft, forKey: draftKey)
        }
    }
}