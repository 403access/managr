import Foundation

// MARK: - Settings and model catalog

struct AssistantSettings: Decodable, Equatable {
    let configured: Bool
    let model: String
    let baseUrl: String
    let local: Bool
    let web: Bool?
}

struct AssistantSelection: Codable, Equatable {
    let providerID: String
    let modelID: String
}

struct AssistantProviderInfo: Decodable, Identifiable, Equatable {
    let id: String
    let name: String
    let protocolName: String
    let local: Bool
    let modelCount: Int

    private enum CodingKeys: String, CodingKey {
        case id, name, local, modelCount
        case protocolName = "protocol"
    }
}

struct AssistantModelInfo: Decodable, Identifiable, Equatable {
    let id: String
    let providerID: String
    let modelID: String
    let name: String
    let providerName: String
    let protocolName: String
    let local: Bool
    let context: Int?
    let maxOutput: Int?

    private enum CodingKeys: String, CodingKey {
        case id, providerID, modelID, name, providerName, local, context, maxOutput
        case protocolName = "protocol"
    }
}

struct AssistantCatalog: Decodable, Equatable {
    let available: Bool
    let error: String?
    let providers: [AssistantProviderInfo]
    let models: [AssistantModelInfo]
    let defaultSelection: AssistantSelection?

    private enum CodingKeys: String, CodingKey {
        case available, error, providers, models
        case defaultSelection = "default"
    }
}

/// The HTTP body of a rejected assistant request, including the setup hint.
struct AssistantAPIError: LocalizedError {
    let message: String
    let notConfigured: Bool
    let status: Int
    let baseUrl: String?
    let model: String?

    var errorDescription: String? { message }
}

// MARK: - Plan

enum AssistantPlanStatus: String, Codable, Equatable {
    case pending
    case doing
    case done
    case skipped
}

enum AssistantPlanChange: String, Codable, Equatable {
    case added
    case changed
    case removed
}

/// One roadmap step as the server sends it.
struct AssistantPlanStep: Codable, Equatable {
    let id: String
    let title: String
    let status: AssistantPlanStatus
    let note: String?
}

/// A roadmap step as the panel keeps it, with a marker for later changes.
struct AssistantPlanStepView: Codable, Equatable, Identifiable {
    let id: String
    let title: String
    let status: AssistantPlanStatus
    let note: String?
    let change: AssistantPlanChange?
}

// MARK: - Writes and proposals

enum AssistantChangeAction: String, Codable, Equatable {
    case add
    case update
    case delete
}

struct AssistantProposalChange: Codable, Equatable, Identifiable {
    let callId: String
    let name: String
    let action: AssistantChangeAction
    let input: JSONValue
    let labels: [String: String]?

    var id: String { callId }
}

struct AssistantProposal: Equatable {
    let id: String
    let changes: [AssistantProposalChange]
}

/// Port of `src/domain/assistant-actions.ts`.
enum AssistantWrite {
    private static let saveIdKeys: [String: String] = [
        "save_customer": "customerId",
        "save_contact": "contactId",
        "save_project": "projectId",
        "save_milestone": "milestoneId",
        "save_director_contract": "personId",
        "save_founder_health": "personId",
    ]

    static func action(name: String, input: JSONValue) -> AssistantChangeAction {
        let updatePrefixes = ["update_", "set_", "complete_", "issue_", "switch_", "offset_", "void_"]
        if name.hasPrefix("delete_") { return .delete }
        if updatePrefixes.contains(where: { name.hasPrefix($0) }) { return .update }
        if name.hasPrefix("save_"), let key = saveIdKeys[name] {
            let id = input.objectValue?[key]?.intValue ?? 0
            return id > 0 ? .update : .add
        }
        return .add
    }

    /// Whether a successful call can change books or settings.
    static func changesData(_ name: String) -> Bool {
        let reads = ["update_plan", "daily_briefing", "vat_overview", "monthly_close_checklist", "draft_dunning_letter", "web_search", "web_fetch"]
        if reads.contains(name) { return false }
        if name.hasPrefix("read_") || name.hasPrefix("check_") { return false }
        return true
    }
}

// MARK: - Chat history

enum AssistantRole: String, Codable {
    case user
    case assistant
}

enum AssistantStepStatus: String, Codable, Equatable {
    case running
    case ok
    case error
}

struct AssistantChatStep: Codable, Equatable, Identifiable {
    let key: String
    let name: String
    let input: JSONValue
    var status: AssistantStepStatus
    var summary: String
    var data: JSONValue?

    var id: String { key }
}

enum AssistantRunStatus: String, Codable, Equatable {
    case ok
    case error
    case stopped
}

/// What the transcript shows under a message.
struct AssistantChatDetails: Codable, Equatable {
    var at: Date
    var durationMs: Int?
    var model: String?
    var provider: String?
    var protocolName: String?
    var baseUrl: String?
    var local: Bool?
    var mcpServer: String?
    var toolCalls: Int?
    var status: AssistantRunStatus?
    var retries: Int?
    var lastRetryAt: Date?
}

struct AssistantChatMessage: Codable, Equatable, Identifiable {
    let id: Int
    let role: AssistantRole
    let content: String
    let steps: [AssistantChatStep]
    let details: AssistantChatDetails?
    let plan: [AssistantPlanStepView]?
}

/// The open turn while its events arrive.
struct AssistantTurnState: Equatable {
    var content = ""
    var steps: [AssistantChatStep] = []
    var proposal: AssistantProposal?
    var plan: [AssistantPlanStepView] = []
    var model: AssistantStreamModel?
    var error = ""
    var sawReply = false
    var seq = 0
}

struct AssistantStreamModel: Equatable {
    let model: String
    let baseUrl: String
    let local: Bool
    let providerID: String?
    let modelID: String?
    let protocolName: String?
}

// MARK: - Stream events

enum AssistantStreamEvent {
    case model(model: String, baseUrl: String, local: Bool, providerID: String?, modelID: String?, protocolName: String?)
    case delta(text: String)
    case reset
    case tool(name: String, input: JSONValue)
    case toolResult(name: String, input: JSONValue, ok: Bool, summary: String, data: JSONValue?)
    case proposal(id: String, changes: [AssistantProposalChange])
    case plan(steps: [AssistantPlanStep])
    case reply(text: String)
    case error(message: String)
}

extension AssistantStreamEvent: Decodable {
    private enum Keys: String, CodingKey {
        case type, text, name, input, ok, summary, data, id, changes, steps, message
        case model, baseUrl, local, providerID, modelID, protocolName = "protocol"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: Keys.self)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "model":
            self = .model(
                model: try container.decode(String.self, forKey: .model),
                baseUrl: try container.decode(String.self, forKey: .baseUrl),
                local: try container.decodeIfPresent(Bool.self, forKey: .local) ?? false,
                providerID: try container.decodeIfPresent(String.self, forKey: .providerID),
                modelID: try container.decodeIfPresent(String.self, forKey: .modelID),
                protocolName: try container.decodeIfPresent(String.self, forKey: .protocolName)
            )
        case "delta":
            self = .delta(text: try container.decode(String.self, forKey: .text))
        case "reset":
            self = .reset
        case "tool":
            self = .tool(
                name: try container.decode(String.self, forKey: .name),
                input: try container.decodeIfPresent(JSONValue.self, forKey: .input) ?? .null
            )
        case "tool_result":
            self = .toolResult(
                name: try container.decode(String.self, forKey: .name),
                input: try container.decodeIfPresent(JSONValue.self, forKey: .input) ?? .null,
                ok: try container.decode(Bool.self, forKey: .ok),
                summary: try container.decodeIfPresent(String.self, forKey: .summary) ?? "",
                data: try container.decodeIfPresent(JSONValue.self, forKey: .data)
            )
        case "proposal":
            self = .proposal(
                id: try container.decode(String.self, forKey: .id),
                changes: try container.decode([AssistantProposalChange].self, forKey: .changes)
            )
        case "plan":
            self = .plan(steps: try container.decode([AssistantPlanStep].self, forKey: .steps))
        case "reply":
            self = .reply(text: try container.decode(String.self, forKey: .text))
        case "error":
            self = .error(message: try container.decode(String.self, forKey: .message))
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "Unknown assistant event: \(type)")
        }
    }
}

// MARK: - Replay

/// Folds one stream event into the open turn, like `assistant-stream.ts`.
enum AssistantReplay {
    static func apply(_ state: AssistantTurnState, _ event: AssistantStreamEvent) -> AssistantTurnState {
        var next = state
        // A proposal only survives until the next event that is not its own answer.
        if next.proposal != nil {
            switch event {
            case .model, .proposal, .plan: break
            default: next.proposal = nil
            }
        }
        switch event {
        case .model(let model, let baseUrl, let local, let providerID, let modelID, let protocolName):
            next.model = AssistantStreamModel(
                model: model,
                baseUrl: baseUrl,
                local: local,
                providerID: providerID,
                modelID: modelID,
                protocolName: protocolName
            )
        case .delta(let text):
            next.content += text
        case .reset:
            next.content = ""
        case .tool(let name, let input):
            next.seq += 1
            next.steps.append(AssistantChatStep(key: "\(next.seq)", name: name, input: input, status: .running, summary: ""))
        case .toolResult(_, _, let ok, let summary, let data):
            if let index = next.steps.indices.last {
                next.steps[index].status = ok ? .ok : .error
                next.steps[index].summary = summary
                next.steps[index].data = data
            }
        case .proposal(let id, let changes):
            next.proposal = AssistantProposal(id: id, changes: changes)
        case .plan(let steps):
            next.plan = mergePlan(previous: next.plan, next: steps)
        case .reply(let text):
            next.content = text
            next.sawReply = true
        case .error(let message):
            next.error = message
        }
        return next
    }

    /// Port of `src/domain/assistant-plan.ts`.
    static func mergePlan(previous: [AssistantPlanStepView], next: [AssistantPlanStep]) -> [AssistantPlanStepView] {
        let before = Dictionary(uniqueKeysWithValues: previous.map { ($0.id, $0) })
        let nextIds = Set(next.map(\.id))
        var merged: [AssistantPlanStepView] = next.map { step in
            if let old = before[step.id] {
                var change = old.change
                if old.title != step.title {
                    change = .changed
                } else if old.status != .skipped && step.status == .skipped {
                    change = .removed
                } else if old.status == .skipped && step.status != .skipped {
                    change = .changed
                } else if (old.note ?? "") != (step.note ?? "") {
                    change = .changed
                }
                return AssistantPlanStepView(id: step.id, title: step.title, status: step.status, note: step.note, change: change)
            }
            return AssistantPlanStepView(
                id: step.id,
                title: step.title,
                status: step.status,
                note: step.note,
                change: previous.isEmpty ? nil : .added
            )
        }
        for old in previous where !nextIds.contains(old.id) {
            merged.append(AssistantPlanStepView(id: old.id, title: old.title, status: .skipped, note: old.note, change: .removed))
        }
        return merged
    }
}

// MARK: - JSONValue helpers

extension JSONValue {
    var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }

    var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    var boolValue: Bool? {
        if case .bool(let value) = self { return value }
        return nil
    }

    var isEmpty: Bool {
        switch self {
        case .null: return true
        case .string(let value): return value.isEmpty
        case .array(let value): return value.isEmpty
        case .object(let value): return value.isEmpty
        default: return false
        }
    }

    var prettyPrinted: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard let data = try? encoder.encode(self), let text = String(data: data, encoding: .utf8) else {
            return String(describing: self)
        }
        return text
    }

    /// A short one-line hint that tells one call in a group from its siblings.
    var stepHint: String {
        switch self {
        case .string(let value): return value
        case .int(let value): return String(value)
        case .double(let value): return String(value)
        case .object(let value):
            for entry in value.values {
                if case .string(let text) = entry, !text.trimmingCharacters(in: .whitespaces).isEmpty { return text }
                if case .int(let number) = entry { return String(number) }
            }
            return ""
        default:
            return ""
        }
    }
}

extension Date {
    /// The compact timestamp the transcript shows under a message.
    func assistantStamp(locale: AppLocale) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: locale == .de ? "de_DE" : "en_GB")
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }
}