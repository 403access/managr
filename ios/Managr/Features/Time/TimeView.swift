import SwiftUI

struct TimeView: View {
    @Environment(AppState.self) private var app
    @State private var week: TimeResponse?
    @State private var anchor: String?
    @State private var error: String?
    @State private var actionError: String?
    @State private var showAdd = false
    @State private var pendingDelete: TimeEntry?

    private var days: [(String, [TimeEntry])] {
        guard let week else { return [] }
        return Dictionary(grouping: week.entries, by: \.entryDate)
            .map { ($0.key, $0.value.sorted { $0.startedAt < $1.startedAt }) }
            .sorted { $0.0 > $1.0 }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error {
                    InlineError(message: error) {
                        Task { await load(anchor: anchor) }
                    }
                }

                if let week {
                    weekHeader(week)
                    totals(week)
                    if days.isEmpty {
                        Panel {
                            EmptyState(
                                icon: "clock",
                                title: app.t("Keine Zeit gebucht", "No time booked"),
                                message: app.t("Für diese Woche ist nichts erfasst.", "Nothing is recorded for this week.")
                            )
                        }
                    } else {
                        ForEach(days, id: \.0) { day, entries in
                            daySection(day: day, entries: entries)
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
        .refreshable { await load(anchor: anchor) }
        .task(id: app.dataVersion) { await load(anchor: anchor) }
        .navigationTitle(app.t("Zeit", "Time"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.pine)
                }
                .accessibilityLabel(app.t("Zeit buchen", "Book time"))
            }
        }
        .sheet(isPresented: $showAdd) {
            if let week {
                AddTimeView(
                    today: week.today,
                    projects: week.projects,
                    people: week.people,
                    contacts: week.contacts,
                    tasks: week.tasks
                )
                .environment(app)
            }
        }
        .alert(app.t("Eintrag löschen?", "Delete entry?"), isPresented: Binding(
            get: { pendingDelete != nil },
            set: { if !$0 { pendingDelete = nil } }
        )) {
            Button(app.t("Löschen", "Delete"), role: .destructive) {
                if let entry = pendingDelete {
                    Task { await delete(entry) }
                }
            }
            Button(app.t("Abbrechen", "Cancel"), role: .cancel) { pendingDelete = nil }
        } message: {
            Text(app.t("Der Eintrag wird ausgeblendet und kann unter Papierkorb wiederhergestellt werden.", "The entry is hidden and can be restored from the trash."))
        }
        .alert(app.t("Aktion fehlgeschlagen", "Action failed"), isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    private func weekHeader(_ week: TimeResponse) -> some View {
        HStack(spacing: 12) {
            Button {
                Task { await go(to: week.previous) }
            } label: {
                Image(systemName: "chevron.left")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(Theme.card, in: Circle())
                    .overlay(Circle().stroke(Theme.line, lineWidth: 1))
            }
            .foregroundStyle(Theme.pine)

            VStack(spacing: 2) {
                Text("\(Format.date(week.start)) – \(Format.date(week.end))")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                if week.start <= week.today && week.today <= week.end {
                    Text(app.t("Diese Woche", "This week"))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                } else {
                    Button(app.t("Zu heute", "To today")) {
                        Task { await go(to: week.today) }
                    }
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(Theme.pine)
                }
            }
            .frame(maxWidth: .infinity)

            Button {
                Task { await go(to: week.next) }
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .frame(width: 36, height: 36)
                    .background(Theme.card, in: Circle())
                    .overlay(Circle().stroke(Theme.line, lineWidth: 1))
            }
            .foregroundStyle(Theme.pine)
        }
    }

    private func totals(_ week: TimeResponse) -> some View {
        Panel {
            HStack(alignment: .firstTextBaseline, spacing: 16) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(app.t("Gesamt", "Total"))
                        .font(.system(size: 11, weight: .medium))
                        .textCase(.uppercase)
                        .tracking(0.4)
                        .foregroundStyle(Theme.muted)
                    Text(Format.minutes(week.total))
                        .font(.mono(24, weight: .semibold))
                        .foregroundStyle(Theme.pine)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(app.t("Leistbar", "Billable"))
                        .font(.system(size: 11, weight: .medium))
                        .textCase(.uppercase)
                        .tracking(0.4)
                        .foregroundStyle(Theme.muted)
                    Text(Format.euro(week.billableValueCents))
                        .font(.mono(20, weight: .semibold))
                        .foregroundStyle(Theme.ink)
                }
            }
            HStack(spacing: 14) {
                Label(Format.minutes(week.billableTotal), systemImage: "checkmark.circle")
                Label(Format.minutes(week.total - week.billableTotal), systemImage: "minus.circle")
                Spacer()
                Text(app.t("Satz \(Format.euro(week.globalHourlyRateCents))/h", "Rate \(Format.euro(week.globalHourlyRateCents))/h"))
            }
            .font(.system(size: 11))
            .foregroundStyle(Theme.muted)
            .padding(.top, 10)
        }
    }

    private func daySection(day: String, entries: [TimeEntry]) -> some View {
        let total = entries.reduce(0) { $0 + $1.minutes }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text(Format.weekdayShort(day))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Spacer()
                Text(Format.minutes(total))
                    .font(.mono(12))
                    .foregroundStyle(Theme.muted)
            }
            Panel(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                        entryRow(entry)
                        if index < entries.count - 1 {
                            Divider().overlay(Theme.line).padding(.leading, 14)
                        }
                    }
                }
            }
        }
    }

    private func entryRow(_ entry: TimeEntry) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(entry.startedAt)–\(entry.endedAt)")
                    .font(.mono(12, weight: .medium))
                    .foregroundStyle(Theme.ink)
                if entry.breakMinutes > 0 {
                    Text(app.t("\(entry.breakMinutes) min Pause", "\(entry.breakMinutes) min break"))
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.muted)
                }
                Spacer()
                Text(Format.minutes(entry.minutes))
                    .font(.mono(12, weight: .semibold))
                    .foregroundStyle(Theme.pine)
                Text(Format.euro(entry.valueCents))
                    .font(.mono(11))
                    .foregroundStyle(Theme.muted)
                Menu {
                    Button(role: .destructive) {
                        pendingDelete = entry
                    } label: {
                        Label(app.t("Eintrag löschen", "Delete entry"), systemImage: "trash")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.muted)
                        .frame(width: 26, height: 26)
                }
            }

            if !entry.projectName.isEmpty {
                Text(entry.projectName)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.pineDeep)
            }

            ForEach(Array(entry.activities.prefix(3).enumerated()), id: \.offset) { _, activity in
                Text("• \(activity)")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
            }

            HStack(spacing: 6) {
                if entry.billable {
                    Pill(text: app.t("leistbar", "billable"), tone: .moss)
                }
                if !entry.contactName.isEmpty || !entry.personName.isEmpty {
                    Pill(text: entry.contactName.isEmpty ? entry.personName : entry.contactName, tone: .neutral)
                }
                if !entry.error.isEmpty {
                    Label(entry.error, systemImage: "exclamationmark.triangle.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.clay)
                } else if let warning = entry.warnings.first {
                    Label(warning.message, systemImage: "clock.badge.exclamationmark")
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.amber)
                        .lineLimit(2)
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .contentShape(Rectangle())
        .contextMenu {
            Button(role: .destructive) {
                pendingDelete = entry
            } label: {
                Label(app.t("Löschen", "Delete"), systemImage: "trash")
            }
        }
    }

    private func go(to date: String) async {
        anchor = date
        await load(anchor: date)
    }

    private func load(anchor: String?) async {
        guard let client = app.client else { return }
        do {
            let query = anchor.map { [URLQueryItem(name: "week", value: $0)] } ?? []
            let loaded: TimeResponse = try await client.view("time", query: query)
            week = loaded
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }

    private func delete(_ entry: TimeEntry) async {
        guard let client = app.client else { return }
        pendingDelete = nil
        do {
            _ = try await client.run("delete_time", ["id": .int(entry.id)])
            app.didChange()
        } catch {
            actionError = app.friendly(error)
        }
    }
}

struct AddTimeView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    let today: String
    let projects: [ProjectRef]
    let people: [PersonRef]
    let contacts: [ContactRef]
    let tasks: [TaskItem]

    @State private var day: Date
    @State private var start: Date
    @State private var end: Date
    @State private var breakMinutes = "0"
    @State private var projectId: Int?
    @State private var taskType = "development"
    @State private var activities = ""
    @State private var memo = ""
    @State private var billable = true
    @State private var personRef = "none"
    @State private var error: String?
    @State private var busy = false

    private let taskTypes = ["development", "design", "planning", "research", "documentation", "meeting", "communication", "admin", "other"]

    init(today: String, projects: [ProjectRef], people: [PersonRef], contacts: [ContactRef], tasks: [TaskItem]) {
        self.today = today
        self.projects = projects
        self.people = people
        self.contacts = contacts
        self.tasks = tasks
        let base = Format.parseIso(today) ?? Date()
        let calendar = Calendar.current
        _day = State(initialValue: base)
        _start = State(initialValue: calendar.date(bySettingHour: 9, minute: 0, second: 0, of: base) ?? base)
        _end = State(initialValue: calendar.date(bySettingHour: 12, minute: 0, second: 0, of: base) ?? base)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(app.t("Tag", "Day")) {
                    DatePicker(app.t("Datum", "Date"), selection: $day, displayedComponents: .date)
                        .environment(\.locale, Locale(identifier: "de_DE"))
                    DatePicker(app.t("Beginn", "Start"), selection: $start, displayedComponents: .hourAndMinute)
                        .environment(\.locale, Locale(identifier: "de_DE"))
                    DatePicker(app.t("Ende", "End"), selection: $end, displayedComponents: .hourAndMinute)
                        .environment(\.locale, Locale(identifier: "de_DE"))
                    HStack {
                        Text(app.t("Pause", "Break"))
                        Spacer()
                        TextField("0", text: $breakMinutes)
                            .keyboardType(.numberPad)
                            .multilineTextAlignment(.trailing)
                            .frame(width: 70)
                        Text("min")
                            .foregroundStyle(Theme.muted)
                    }
                    Text(app.t("Ergibt \(workedMinutes) Minuten.", "That is \(workedMinutes) minutes."))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                }

                Section(app.t("Projekt", "Project")) {
                    Picker(app.t("Projekt", "Project"), selection: $projectId) {
                        Text(app.t("Kein Projekt", "No project")).tag(Int?.none)
                        ForEach(projects) { project in
                            Text(project.name).tag(Int?.some(project.id))
                        }
                    }
                    Picker(app.t("Art der Arbeit", "Kind of work"), selection: $taskType) {
                        ForEach(taskTypes, id: \.self) { type in
                            Text(Format.taskType(type, app.locale)).tag(type)
                        }
                    }
                    if !contacts.isEmpty || !people.isEmpty {
                        Picker(app.t("Mit", "With"), selection: $personRef) {
                            Text(app.t("Niemand", "Nobody")).tag("none")
                            ForEach(people) { person in
                                Text("\(person.firstName) \(person.lastName)")
                                    .tag("employee:\(person.id)")
                            }
                            ForEach(contacts) { contact in
                                Text("\(contact.firstName) \(contact.lastName)")
                                    .tag("contact:\(contact.id)")
                            }
                        }
                    }
                    Toggle(app.t("Leistbar", "Billable"), isOn: $billable)
                }

                Section {
                    TextEditor(text: $activities)
                        .frame(minHeight: 96)
                        .font(.system(size: 14))
                } header: {
                    Text(app.t("Aktivitäten", "Activities"))
                } footer: {
                    Text(app.t("Eine Zeile pro Tätigkeit. Daraus werden später Rechnungspositionen.", "One line per activity. They become invoice line items later."))
                }

                Section(app.t("Interne Notiz", "Internal note")) {
                    TextField(app.t("Nur für den Schreibtisch", "Desk only"), text: $memo, axis: .vertical)
                        .lineLimit(2...5)
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.clay)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .navigationTitle(app.t("Zeit buchen", "Book time"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy {
                            ProgressView().tint(Theme.pine)
                        } else {
                            Text(app.t("Buchen", "Book")).fontWeight(.semibold)
                        }
                    }
                    .disabled(busy)
                }
            }
        }
    }

    private var workedMinutes: Int {
        let calendar = Calendar.current
        let base = calendar.startOfDay(for: day)
        let startDate = calendar.date(bySettingHour: calendar.component(.hour, from: start), minute: calendar.component(.minute, from: start), second: 0, of: base) ?? base
        let endDate = calendar.date(bySettingHour: calendar.component(.hour, from: end), minute: calendar.component(.minute, from: end), second: 0, of: base) ?? base
        let breaks = Int(breakMinutes) ?? 0
        return max(0, Int(endDate.timeIntervalSince(startDate) / 60) - breaks)
    }

    private func save() async {
        guard let client = app.client else { return }
        let breaks = Int(breakMinutes) ?? 0
        guard breaks >= 0, breaks <= 600 else {
            error = app.t("Die Pause muss zwischen 0 und 600 Minuten liegen.", "The break must be between 0 and 600 minutes.")
            return
        }
        guard workedMinutes > 0 else {
            error = app.t("Das Ende muss nach dem Beginn liegen.", "The end must be after the start.")
            return
        }
        let lines = activities
            .split(whereSeparator: \.isNewline)
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }

        busy = true
        defer { busy = false }

        var args: [String: JSONValue] = [
            "entryDate": .string(Format.iso(from: day)),
            "startedAt": .string(Format.clock(from: start)),
            "endedAt": .string(Format.clock(from: end)),
            "breakMinutes": .int(breaks),
            "taskType": .string(taskType),
            "billable": .bool(billable),
            "activities": .array(lines.map { .string($0) })
        ]
        if !memo.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            args["memo"] = .string(memo)
        }
        if let projectId {
            args["projectId"] = .int(projectId)
        }
        if personRef.hasPrefix("employee:"), let id = Int(personRef.dropFirst("employee:".count)) {
            args["personId"] = .int(id)
        } else if personRef.hasPrefix("contact:"), let id = Int(personRef.dropFirst("contact:".count)) {
            args["contactId"] = .int(id)
        }

        do {
            _ = try await client.run("add_time", args)
            app.didChange()
            dismiss()
        } catch {
            self.error = app.friendly(error)
        }
    }
}