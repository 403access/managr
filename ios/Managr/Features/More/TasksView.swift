import SwiftUI

struct TasksView: View {
    @Environment(AppState.self) private var app
    @State private var tasks: [TaskItem] = []
    @State private var error: String?
    @State private var actionError: String?
    @State private var showAdd = false
    @State private var busyId: Int?

    private var open: [TaskItem] {
        tasks.filter { $0.status != "done" }
            .sorted { ($0.dueDate ?? "9999") < ($1.dueDate ?? "9999") }
    }

    private var done: [TaskItem] {
        tasks.filter { $0.status == "done" }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                if tasks.isEmpty {
                    Panel {
                        EmptyState(
                            icon: "checklist",
                            title: app.t("Keine Aufgaben", "No tasks"),
                            message: app.t("Lege die erste Aufgabe an.", "Add the first task.")
                        )
                    }
                } else {
                    if !open.isEmpty {
                        section(title: app.t("Offen", "Open"), count: open.count, items: open)
                    }
                    if !done.isEmpty {
                        section(title: app.t("Erledigt", "Done"), count: done.count, items: done)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(app.t("Aufgaben", "Tasks"))
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.pine)
                }
                .accessibilityLabel(app.t("Aufgabe anlegen", "Add task"))
            }
        }
        .sheet(isPresented: $showAdd) {
            AddTaskView()
                .environment(app)
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

    private func section(title: String, count: Int, items: [TaskItem]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            SectionHeading(title: title, detail: "\(count)")
            Panel(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(items.enumerated()), id: \.element.id) { index, task in
                        row(task)
                        if index < items.count - 1 {
                            Divider().overlay(Theme.line).padding(.leading, 44)
                        }
                    }
                }
            }
        }
    }

    private func row(_ task: TaskItem) -> some View {
        HStack(spacing: 10) {
            Button {
                Task { await toggle(task) }
            } label: {
                Image(systemName: task.status == "done" ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 20))
                    .foregroundStyle(task.status == "done" ? Theme.moss : Theme.muted)
            }
            .buttonStyle(.plain)
            .disabled(busyId == task.id)

            VStack(alignment: .leading, spacing: 3) {
                Text(task.title)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .strikethrough(task.status == "done")
                HStack(spacing: 8) {
                    if let due = task.dueDate, !due.isEmpty {
                        Text(Format.date(due))
                            .font(.system(size: 11))
                            .foregroundStyle(due < Format.iso(from: Date()) && task.status != "done" ? Theme.clay : Theme.muted)
                    }
                    if let type = task.taskType, type != "other" {
                        Text(Format.taskType(type, app.locale))
                            .font(.system(size: 11))
                            .foregroundStyle(Theme.muted)
                    }
                    if task.deliverable == true {
                        Pill(text: app.t("Lieferung", "Deliverable"), tone: .pine)
                    }
                }
            }
            Spacer(minLength: 0)
            if busyId == task.id {
                ProgressView().tint(Theme.pine)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            tasks = try await client.call("read_tasks", as: [TaskItem].self)
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }

    private func toggle(_ task: TaskItem) async {
        guard let client = app.client else { return }
        busyId = task.id
        defer { busyId = nil }
        let next = task.status == "done" ? "open" : "done"
        do {
            _ = try await client.run("set_task_status", ["taskId": .int(task.id), "status": .string(next)])
            app.didChange()
        } catch {
            actionError = app.friendly(error)
        }
    }
}

struct AddTaskView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss

    @State private var title = ""
    @State private var notes = ""
    @State private var taskType = "other"
    @State private var hasDue = false
    @State private var due = Date()
    @State private var deliverable = false
    @State private var error: String?
    @State private var busy = false

    private let taskTypes = ["development", "design", "planning", "research", "documentation", "meeting", "communication", "admin", "other"]

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(app.t("Was ist zu tun?", "What needs doing?"), text: $title, axis: .vertical)
                        .lineLimit(1...3)
                }
                Section {
                    Picker(app.t("Art", "Kind"), selection: $taskType) {
                        ForEach(taskTypes, id: \.self) { type in
                            Text(Format.taskType(type, app.locale)).tag(type)
                        }
                    }
                    Toggle(app.t("Fälligkeitsdatum", "Due date"), isOn: $hasDue.animation())
                    if hasDue {
                        DatePicker(app.t("Fällig", "Due"), selection: $due, displayedComponents: .date)
                            .environment(\.locale, Locale(identifier: "de_DE"))
                    }
                    Toggle(app.t("Lieferung", "Deliverable"), isOn: $deliverable)
                }
                Section(app.t("Notiz", "Note")) {
                    TextField(app.t("Optional", "Optional"), text: $notes, axis: .vertical)
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
            .navigationTitle(app.t("Aufgabe anlegen", "Add task"))
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
                            Text(app.t("Speichern", "Save")).fontWeight(.semibold)
                        }
                    }
                    .disabled(busy || title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        guard let client = app.client else { return }
        busy = true
        defer { busy = false }
        var args: [String: JSONValue] = [
            "title": .string(title.trimmingCharacters(in: .whitespaces)),
            "taskType": .string(taskType),
            "deliverable": .bool(deliverable)
        ]
        if hasDue {
            args["dueDate"] = .string(Format.iso(from: due))
        }
        if !notes.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            args["notes"] = .string(notes)
        }
        do {
            _ = try await client.run("add_task", args)
            app.didChange()
            dismiss()
        } catch {
            self.error = app.friendly(error)
        }
    }
}