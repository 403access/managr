import SwiftUI

struct ObligationsView: View {
    @Environment(AppState.self) private var app
    @State private var response: ObligationsResponse?
    @State private var error: String?
    @State private var actionError: String?
    @State private var busyKey: String?

    private var overdue: [Obligation] {
        guard let response else { return [] }
        return response.due.filter { $0.status != "done" && $0.status != "skipped" && $0.dueDate < response.today }
    }

    private var upcoming: [Obligation] {
        guard let response else { return [] }
        return response.due.filter { $0.status != "done" && $0.status != "skipped" && $0.dueDate >= response.today }
    }

    private var later: [Obligation] {
        guard let response else { return [] }
        return response.later.filter { $0.status != "done" && $0.status != "skipped" }
    }

    private var deadlines: [CustomDeadline] {
        response?.deadlines.filter { $0.status != "done" } ?? []
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                if let response {
                    summary(response)
                    if !overdue.isEmpty {
                        section(title: app.t("Überfällig", "Overdue"), count: overdue.count) {
                            ForEach(Array(overdue.enumerated()), id: \.element.id) { index, item in
                                obligationRow(item, today: response.today)
                                rowDivider(index: index, total: overdue.count)
                            }
                        }
                    }
                    if !upcoming.isEmpty {
                        section(title: app.t("Als Nächstes", "Upcoming"), count: upcoming.count) {
                            ForEach(Array(upcoming.enumerated()), id: \.element.id) { index, item in
                                obligationRow(item, today: response.today)
                                rowDivider(index: index, total: upcoming.count)
                            }
                        }
                    }
                    if !deadlines.isEmpty {
                        section(title: app.t("Eigene Fristen", "Custom deadlines"), count: deadlines.count) {
                            ForEach(Array(deadlines.enumerated()), id: \.element.id) { index, deadline in
                                deadlineRow(deadline, today: response.today)
                                rowDivider(index: index, total: deadlines.count)
                            }
                        }
                    }
                    if !later.isEmpty {
                        section(title: app.t("Später", "Later"), count: later.count) {
                            ForEach(Array(later.enumerated()), id: \.element.id) { index, item in
                                obligationRow(item, today: response.today)
                                rowDivider(index: index, total: later.count)
                            }
                        }
                    }
                    if !response.reminders.isEmpty {
                        section(title: app.t("Versicherungen", "Insurance"), count: response.reminders.count) {
                            ForEach(Array(response.reminders.enumerated()), id: \.element.id) { index, reminder in
                                HStack(spacing: 10) {
                                    Circle()
                                        .fill(reminder.overdue ? Theme.clay : Theme.amber)
                                        .frame(width: 7, height: 7)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(reminder.label)
                                            .font(.system(size: 13, weight: .medium))
                                            .foregroundStyle(Theme.ink)
                                        Text(Format.date(reminder.renewalDate))
                                            .font(.system(size: 11))
                                            .foregroundStyle(reminder.overdue ? Theme.clay : Theme.muted)
                                    }
                                    Spacer()
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 11)
                                rowDivider(index: index, total: response.reminders.count)
                            }
                        }
                    }
                    if overdue.isEmpty && upcoming.isEmpty && later.isEmpty && deadlines.isEmpty && response.reminders.isEmpty {
                        Panel {
                            EmptyState(icon: "calendar.badge.checkmark", title: app.t("Nichts offen", "Nothing open"))
                        }
                    }
                } else if error == nil {
                    ProgressView()
                        .tint(Theme.pine)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(app.t("Fristen", "Deadlines"))
        .navigationBarTitleDisplayMode(.inline)
        .alert(app.t("Aktion fehlgeschlagen", "Action failed"), isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    private func summary(_ response: ObligationsResponse) -> some View {
        HStack(spacing: 10) {
            MetricTile(
                label: app.t("Überfällig", "Overdue"),
                value: "\(overdue.count)",
                detail: app.t("offene Pflichten", "open duties"),
                tone: overdue.isEmpty ? .moss : .clay
            )
            MetricTile(
                label: app.t("Kommend", "Upcoming"),
                value: "\(upcoming.count)",
                detail: app.t("geplant", "scheduled"),
                tone: .amber
            )
        }
    }

    private func section<Content: View>(title: String, count: Int, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeading(title: title, detail: "\(count)")
            Panel(padding: 0) {
                VStack(spacing: 0) {
                    content()
                }
            }
        }
    }

    private func rowDivider(index: Int, total: Int) -> some View {
        Group {
            if index < total - 1 {
                Divider().overlay(Theme.line).padding(.leading, 30)
            }
        }
    }

    private func obligationRow(_ obligation: Obligation, today: String) -> some View {
        let isOverdue = obligation.dueDate < today
        return HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(isOverdue ? Theme.clay : Theme.amber)
                .frame(width: 7, height: 7)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(obligation.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.ink)
                HStack(spacing: 6) {
                    Text(Format.date(obligation.dueDate))
                    Text("·")
                    Text(Format.dueLabel(obligation.dueDate, today: today, locale: app.locale))
                }
                .font(.system(size: 11))
                .foregroundStyle(isOverdue ? Theme.clay : Theme.muted)
                Text(categoryLabel(obligation.category))
                    .font(.system(size: 10))
                    .textCase(.uppercase)
                    .tracking(0.3)
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 4)
            if busyKey == obligation.key {
                ProgressView().tint(Theme.pine).scaleEffect(0.8)
            } else {
                Menu {
                    if obligation.status == "done" {
                        Button(app.t("Wieder öffnen", "Reopen")) {
                            Task { await setObligation(obligation.key, status: "open") }
                        }
                    } else {
                        Button(app.t("Als erledigt markieren", "Mark as done")) {
                            Task { await setObligation(obligation.key, status: "done") }
                        }
                    }
                    Button(app.t("Später im Jahr", "Later this year")) {
                        Task { await setObligation(obligation.key, status: "skipped") }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 32, height: 32)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private func deadlineRow(_ deadline: CustomDeadline, today: String) -> some View {
        let isOverdue = deadline.dueDate < today
        return HStack(alignment: .top, spacing: 10) {
            Circle()
                .fill(isOverdue ? Theme.clay : Theme.pine)
                .frame(width: 7, height: 7)
                .padding(.top, 5)
            VStack(alignment: .leading, spacing: 3) {
                Text(deadline.title)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Theme.ink)
                Text("\(Format.date(deadline.dueDate)) · \(Format.dueLabel(deadline.dueDate, today: today, locale: app.locale))")
                    .font(.system(size: 11))
                    .foregroundStyle(isOverdue ? Theme.clay : Theme.muted)
                if deadline.recurrence != "none" {
                    Text(deadline.recurrence)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.muted)
                }
            }
            Spacer(minLength: 4)
            if busyKey == "deadline-\(deadline.id)" {
                ProgressView().tint(Theme.pine).scaleEffect(0.8)
            } else {
                Menu {
                    Button(app.t("Als erledigt markieren", "Mark as done")) {
                        Task { await completeDeadline(deadline.id) }
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 32, height: 32)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private func categoryLabel(_ key: String) -> String {
        switch key {
        case "tax": return app.t("Steuern", "Tax")
        case "corporate": return app.t("Gesellschaft", "Company")
        case "trade": return app.t("Gewerbe", "Trade")
        case "legal": return app.t("Recht", "Legal")
        case "social": return app.t("Sozialversicherung", "Social insurance")
        default: return key
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            response = try await client.view("obligations")
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }

    private func setObligation(_ key: String, status: String) async {
        guard let client = app.client else { return }
        busyKey = key
        defer { busyKey = nil }
        do {
            _ = try await client.run("set_obligation", ["key": .string(key), "status": .string(status)])
            app.didChange()
        } catch {
            actionError = app.friendly(error)
        }
    }

    private func completeDeadline(_ id: Int) async {
        guard let client = app.client else { return }
        busyKey = "deadline-\(id)"
        defer { busyKey = nil }
        do {
            _ = try await client.run("complete_deadline", ["id": .int(id)])
            app.didChange()
        } catch {
            actionError = app.friendly(error)
        }
    }
}