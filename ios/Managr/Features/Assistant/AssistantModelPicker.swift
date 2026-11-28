import SwiftUI

/// A searchable picker for the assistant's provider and model. The native Menu
/// cannot search and becomes unreadable with hundreds of models, so the full
/// list lives in a sheet with a provider filter, the same facts the web panel
/// shows, and a checkmark on the current choice.
struct AssistantModelPicker: View {
    @Environment(AppState.self) private var app
    @Environment(AssistantStore.self) private var store
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var providerFilter: String?

    private var catalog: AssistantCatalog? { store.catalog }

    private var allModels: [AssistantModelInfo] {
        catalog?.models ?? []
    }

    private var matchingModels: [AssistantModelInfo] {
        let byProvider = providerFilter.map { id in
            allModels.filter { $0.providerID == id }
        } ?? allModels
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !text.isEmpty else { return byProvider }
        return byProvider.filter { model in
            model.name.lowercased().contains(text)
                || model.providerName.lowercased().contains(text)
                || model.modelID.lowercased().contains(text)
                || model.providerID.lowercased().contains(text)
        }
    }

    private var groups: [(provider: AssistantProviderInfo, models: [AssistantModelInfo])] {
        let providers = catalog?.providers ?? []
        let known = Dictionary(uniqueKeysWithValues: providers.map { ($0.id, $0) })
        var order = providers.map(\.id)
        var seen = Set(order)
        for model in matchingModels where !seen.contains(model.providerID) {
            order.append(model.providerID)
            seen.insert(model.providerID)
        }
        return order.compactMap { id in
            let models = matchingModels.filter { $0.providerID == id }
            guard let first = models.first else { return nil }
            let provider = known[id] ?? AssistantProviderInfo(
                id: id,
                name: first.providerName,
                protocolName: first.protocolName,
                local: first.local,
                modelCount: models.count
            )
            return (provider, models)
        }
    }

    private var usableProviders: [AssistantProviderInfo] {
        (catalog?.providers ?? []).filter { $0.modelCount > 0 }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if catalog == nil {
                    loadingState
                } else if allModels.isEmpty {
                    unavailableState
                } else {
                    providerStrip
                    Divider().overlay(Theme.line)
                    modelList
                }
            }
            .deskBackground()
            .navigationTitle(app.t("Modell wählen", "Choose model"))
            .navigationBarTitleDisplayMode(.inline)
            .searchable(
                text: $query,
                placement: .navigationBarDrawer(displayMode: .always),
                prompt: app.t("Modell oder Anbieter suchen", "Search model or provider")
            )
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(app.t("Fertig", "Done")) { dismiss() }
                        .foregroundStyle(Theme.pine)
                }
            }
        }
    }

    // MARK: - States

    private var loadingState: some View {
        VStack(spacing: 12) {
            ProgressView().tint(Theme.pine)
            Text(app.t("Modelle werden geladen …", "Loading models …"))
                .font(.system(size: 13))
                .foregroundStyle(Theme.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var unavailableState: some View {
        ScrollView {
            VStack(spacing: 16) {
                EmptyState(
                    icon: "cpu",
                    title: app.t("Kein Modell verfügbar", "No model available"),
                    message: app.t(
                        "opencode kennt diese Anbieter, aber keiner bietet ein Modell, das managr ansteuern kann. Ein Modell braucht Werkzeugaufrufe und einen OpenAI- oder Anthropic-kompatiblen Endpunkt.",
                        "opencode knows these providers, but none offers a model managr can drive. A model needs tool calling and an OpenAI- or Anthropic-compatible endpoint."
                    )
                )
                if let error = catalog?.error, !error.isEmpty {
                    Text(error)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.clay)
                        .multilineTextAlignment(.center)
                }
                Button {
                    Task { await store.refreshModels() }
                } label: {
                    Label(app.t("Neu laden", "Reload"), systemImage: "arrow.clockwise")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.pine)
                }
            }
            .padding(20)
        }
    }

    // MARK: - Provider filter

    private var providerStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 7) {
                providerChip(
                    id: nil,
                    label: app.t("Alle", "All"),
                    count: allModels.count
                )
                ForEach(usableProviders) { provider in
                    providerChip(
                        id: provider.id,
                        label: provider.id == "env" ? app.t("Umgebung", "Environment") : provider.name,
                        count: provider.modelCount
                    )
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 9)
        }
        .background(Theme.paper)
    }

    private func providerChip(id: String?, label: String, count: Int) -> some View {
        let active = providerFilter == id
        return Button {
            providerFilter = id
        } label: {
            HStack(spacing: 5) {
                Text(label)
                    .font(.system(size: 12, weight: .medium))
                    .lineLimit(1)
                Text("\(count)")
                    .font(.mono(9))
                    .foregroundStyle(active ? Color.white.opacity(0.8) : Theme.muted)
            }
            .foregroundStyle(active ? Color.white : Theme.ink)
            .padding(.horizontal, 11)
            .padding(.vertical, 7)
            .background(active ? Theme.pine : Theme.card, in: Capsule())
            .overlay(Capsule().stroke(active ? Color.clear : Theme.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - Models

    private var modelList: some View {
        ScrollViewReader { proxy in
            List {
                if matchingModels.isEmpty {
                    Text(app.t("Keine Treffer", "No results"))
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.muted)
                        .listRowBackground(Color.clear)
                        .listRowSeparator(.hidden)
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 28)
                } else {
                    ForEach(groups, id: \.provider.id) { group in
                        Section {
                            ForEach(group.models) { model in
                                row(model)
                                    .id(modelKey(model))
                            }
                        } header: {
                            providerHeader(group.provider)
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .scrollDismissesKeyboard(.interactively)
            .onAppear { scrollToSelection(proxy) }
            .onChange(of: providerFilter) { _, _ in scrollToSelection(proxy) }
        }
    }

    private func modelKey(_ model: AssistantModelInfo) -> String {
        "\(model.providerID)|\(model.modelID)"
    }

    private func scrollToSelection(_ proxy: ScrollViewProxy) {
        guard let selection = store.selection else { return }
        let key = "\(selection.providerID)|\(selection.modelID)"
        DispatchQueue.main.async {
            withAnimation(nil) {
                proxy.scrollTo(key, anchor: .center)
            }
        }
    }

    private func providerHeader(_ provider: AssistantProviderInfo) -> some View {
        HStack(spacing: 6) {
            Text(provider.id == "env" ? app.t("Umgebung", "Environment") : provider.name)
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
            Text(provider.local ? app.t("lokal", "local") : app.t("extern", "remote"))
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(provider.local ? Theme.moss : Theme.amber)
            Text(protocolLabel(provider.protocolName))
                .font(.system(size: 9, weight: .medium))
                .foregroundStyle(Theme.pine)
        }
    }

    private func row(_ model: AssistantModelInfo) -> some View {
        let selected = store.selection == AssistantSelection(providerID: model.providerID, modelID: model.modelID)
        return Button {
            store.choose(model)
            dismiss()
        } label: {
            HStack(alignment: .top, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(model.name)
                        .font(.system(size: 14, weight: selected ? .semibold : .regular))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(2)
                    HStack(spacing: 5) {
                        Text(model.providerName)
                            .lineLimit(1)
                        Text("·")
                        Text(model.local ? app.t("lokal", "local") : app.t("extern", "remote"))
                            .foregroundStyle(model.local ? Theme.moss : Theme.amber)
                        Text("·")
                        Text(protocolLabel(model.protocolName))
                            .foregroundStyle(Theme.pine)
                        if let context = contextHint(model.context) {
                            Text("·")
                            Text("\(context) \(app.t("Kontext", "context"))")
                        }
                    }
                    .font(.system(size: 10))
                    .foregroundStyle(Theme.muted)
                }
                Spacer(minLength: 0)
                if selected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Theme.pine)
                        .padding(.top, 1)
                }
            }
            .contentShape(Rectangle())
            .padding(.vertical, 3)
        }
        .buttonStyle(.plain)
        .listRowBackground(selected ? Theme.pine.opacity(0.07) : Theme.card)
    }

    private func protocolLabel(_ value: String) -> String {
        if value == "anthropic" { return app.t("Anthropic-Format", "Anthropic format") }
        if value == "agy" { return app.t("Antigravity-Format", "Antigravity format") }
        return app.t("OpenAI-Format", "OpenAI format")
    }

    /// The compact context length the web panel shows beside a model.
    private func contextHint(_ tokens: Int?) -> String? {
        guard let tokens, tokens >= 1_000 else { return nil }
        if tokens >= 1_000_000 {
            let millions = Double(tokens) / 1_000_000
            return millions == millions.rounded() ? "\(Int(millions))M" : String(format: "%.1fM", millions)
        }
        return "\(tokens / 1_000)k"
    }
}