import SwiftUI

struct PeopleListView: View {
    @Environment(AppState.self) private var app
    @State private var people: [Person] = []
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }
                if people.isEmpty {
                    Panel {
                        EmptyState(
                            icon: "person.2",
                            title: app.t("Keine Personen", "No people"),
                            message: app.t("Für diese Firma ist niemand beschäftigt.", "Nobody is employed at this company.")
                        )
                    }
                } else {
                    ForEach(people) { person in
                        Panel(padding: 14) {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(alignment: .firstTextBaseline) {
                                    Text(person.name)
                                        .font(.system(size: 15, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                    Spacer()
                                    Pill(text: Status.kind(person.kind, app.locale), tone: .pine)
                                }
                                if !person.role.isEmpty {
                                    Text(person.role)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Theme.muted)
                                }
                                HStack {
                                    Text(Format.euro(person.grossMonthlyCents))
                                        .font(.mono(13, weight: .semibold))
                                        .foregroundStyle(Theme.ink)
                                    Text(app.t("brutto / Monat", "gross / month"))
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.muted)
                                    Spacer()
                                    if !person.regime.isEmpty {
                                        Text(person.regime)
                                            .font(.system(size: 10))
                                            .foregroundStyle(Theme.muted)
                                    }
                                }
                                if !person.estimateError.isEmpty {
                                    Text(person.estimateError)
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.clay)
                                }
                            }
                        }
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
        .navigationTitle(app.t("Personen", "People"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let response: PeopleResponse = try await client.view("people")
            people = response.people
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}

struct ProjectsView: View {
    @Environment(AppState.self) private var app
    @State private var projects: [Project] = []
    @State private var error: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }
                if projects.isEmpty {
                    Panel {
                        EmptyState(icon: "folder", title: app.t("Keine Projekte", "No projects"))
                    }
                } else {
                    ForEach(projects) { project in
                        Panel(padding: 14) {
                            VStack(alignment: .leading, spacing: 8) {
                                HStack(alignment: .top) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(project.name)
                                            .font(.system(size: 15, weight: .medium))
                                            .foregroundStyle(Theme.ink)
                                        if let customerName = project.customerName, !customerName.isEmpty {
                                            Text(customerName)
                                                .font(.system(size: 12))
                                                .foregroundStyle(Theme.muted)
                                        }
                                    }
                                    Spacer()
                                    Pill(text: Status.label(project.status, app.locale), tone: Tone.forStatus(project.status))
                                }
                                HStack(spacing: 14) {
                                    Label(Format.minutes(project.minutes), systemImage: "clock")
                                    Label(Format.euro(project.valueCents), systemImage: "eurosign")
                                    Spacer()
                                    Text(app.t("\(project.openTasks) offen", "\(project.openTasks) open"))
                                }
                                .font(.system(size: 11))
                                .foregroundStyle(Theme.muted)
                                if project.startedOn != "0000-00-00" {
                                    Text("\(Format.date(project.startedOn))\(project.endedOn.map { " – \(Format.date($0))" } ?? "")")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.muted)
                                }
                            }
                        }
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
        .navigationTitle(app.t("Projekte", "Projects"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let response: ProjectsResponse = try await client.view("projects")
            projects = response.projects
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}