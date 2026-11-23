import SwiftUI

struct MoreView: View {
    @Environment(AppState.self) private var app

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Panel {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(app.activeCompanyName)
                            .font(.display(22))
                            .foregroundStyle(Theme.ink)
                        Text(app.t("Verbunden mit \(app.serverDisplay)", "Connected to \(app.serverDisplay)"))
                            .font(.mono(10))
                            .foregroundStyle(Theme.muted)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                }

                group(title: app.t("Arbeit", "Work")) {
                    navRow(
                        title: app.t("Personen", "People"),
                        detail: app.t("Beschäftigung und Löhne", "Employment and payroll"),
                        icon: "person.2",
                        tint: Theme.pine
                    ) { PeopleListView() }
                    divider
                    navRow(
                        title: app.t("Projekte", "Projects"),
                        detail: app.t("Zeit, Kunden und Werte", "Time, customers and value"),
                        icon: "folder",
                        tint: Theme.pine
                    ) { ProjectsView() }
                    divider
                    navRow(
                        title: app.t("Aufgaben", "Tasks"),
                        detail: app.t("Offene Arbeit", "Open work"),
                        icon: "checklist",
                        tint: Theme.pine
                    ) { TasksView() }
                    divider
                    navRow(
                        title: app.t("Assistent", "Assistant"),
                        detail: app.t("Fragen, planen, buchen", "Ask, plan, post"),
                        icon: "sparkles",
                        tint: Theme.pineDeep
                    ) { AssistantView() }
                }

                group(title: app.t("Pflichten", "Obligations")) {
                    navRow(
                        title: app.t("Fristen", "Deadlines"),
                        detail: app.t("Steuern, IHK und Verträge", "Taxes, IHK and contracts"),
                        icon: "calendar.badge.clock",
                        tint: Theme.amber
                    ) { ObligationsView() }
                }

                group(title: app.t("App", "App")) {
                    navRow(
                        title: app.t("Einstellungen", "Settings"),
                        detail: app.t("Verbindung, Sprache, Firma", "Connection, language, company"),
                        icon: "gearshape",
                        tint: Theme.muted
                    ) { SettingsView() }
                }

                Text(app.t(
                    "managr ist ein lokaler Schreibtisch. Die App liest und schreibt direkt in die Datenbank auf deinem Computer.",
                    "managr is a local desk. The app reads and writes straight to the database on your computer."
                ))
                .font(.system(size: 11))
                .foregroundStyle(Theme.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.top, 6)
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .navigationTitle(app.t("Mehr", "More"))
        .navigationBarTitleDisplayMode(.large)
    }

    private var divider: some View {
        Divider().overlay(Theme.line).padding(.leading, 54)
    }

    private func group<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .padding(.leading, 4)
            Panel(padding: 0) {
                VStack(spacing: 0) {
                    content()
                }
            }
        }
    }

    private func navRow<Destination: View>(
        title: String,
        detail: String,
        icon: String,
        tint: Color,
        @ViewBuilder destination: @escaping () -> Destination
    ) -> some View {
        NavigationLink {
            destination()
        } label: {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(tint)
                    .frame(width: 30, height: 30)
                    .background(tint.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(Theme.ink)
                    Text(detail)
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted.opacity(0.6))
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 11)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}