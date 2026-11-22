import SwiftUI

struct SettingsView: View {
    @Environment(AppState.self) private var app
    @State private var busy = false
    @State private var switching: Int?

    private var version: String {
        let short = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(short) (\(build))"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                connectionSection
                languageSection
                companySection
                aboutSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .navigationTitle(app.t("Einstellungen", "Settings"))
        .navigationBarTitleDisplayMode(.inline)
    }

    private var connectionSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.t("Verbindung", "Connection"))
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .padding(.leading, 4)

            Panel {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(alignment: .top, spacing: 10) {
                        Circle()
                            .fill(app.isConnected ? Theme.moss : Theme.clay)
                            .frame(width: 9, height: 9)
                            .padding(.top, 5)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(app.connectionSummary)
                                .font(.system(size: 14, weight: .medium))
                                .foregroundStyle(Theme.ink)
                            Text(app.serverDisplay)
                                .font(.mono(12))
                                .foregroundStyle(Theme.muted)
                                .textSelection(.enabled)
                        }
                        Spacer(minLength: 0)
                        if busy {
                            ProgressView().tint(Theme.pine)
                        }
                    }

                    Divider().overlay(Theme.line)

                    Button {
                        Task {
                            busy = true
                            _ = await app.connect(to: app.serverAddress)
                            busy = false
                        }
                    } label: {
                        Label(app.t("Verbindung prüfen", "Check connection"), systemImage: "arrow.triangle.2.circlepath")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.pine)
                    }
                    .disabled(busy)

                    Button {
                        app.disconnect()
                    } label: {
                        Label(app.t("Andere Adresse verwenden", "Use another address"), systemImage: "network")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.ink)
                    }

                    Text(app.t(
                        "Die App spricht direkt mit dem Schreibtisch. Es gibt kein Konto und keinen Cloud-Dienst; die Daten bleiben in deinem Netzwerk.",
                        "The app talks straight to the desk. There is no account and no cloud service; the data stays on your network."
                    ))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var languageSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.t("Sprache", "Language"))
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .padding(.leading, 4)

            Panel {
                VStack(alignment: .leading, spacing: 10) {
                    Picker("", selection: Binding(
                        get: { app.locale },
                        set: { app.setLocale($0) }
                    )) {
                        Text("Deutsch").tag(AppLocale.de)
                        Text("English").tag(AppLocale.en)
                    }
                    .pickerStyle(.segmented)

                    Text(app.t(
                        "Beträge und Daten bleiben im deutschen Format, wie auf dem Schreibtisch.",
                        "Amounts and dates stay in German format, like on the desk."
                    ))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                }
            }
        }
    }

    private var companySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.t("Firma", "Company"))
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .padding(.leading, 4)

            Panel(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(app.companies.enumerated()), id: \.element.id) { index, company in
                        Button {
                            Task {
                                switching = company.id
                                await app.switchCompany(to: company.id)
                                switching = nil
                            }
                        } label: {
                            HStack(spacing: 10) {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(company.legalName)
                                        .font(.system(size: 14, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                    Text(company.legalForm.uppercased())
                                        .font(.system(size: 10))
                                        .tracking(0.4)
                                        .foregroundStyle(Theme.muted)
                                }
                                Spacer()
                                if switching == company.id {
                                    ProgressView().tint(Theme.pine)
                                } else if company.id == app.shell?.activeCompanyId {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundStyle(Theme.moss)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        if index < app.companies.count - 1 {
                            Divider().overlay(Theme.line).padding(.leading, 14)
                        }
                    }
                }
            }

            Text(app.t(
                "Der Wechsel gilt für den ganzen Schreibtisch, auch im Browser.",
                "The switch applies to the whole desk, including the browser."
            ))
            .font(.system(size: 11))
            .foregroundStyle(Theme.muted)
            .padding(.leading, 4)
        }
    }

    private var aboutSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(app.t("Über die App", "About"))
                .font(.system(size: 11, weight: .semibold))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .padding(.leading, 4)

            Panel {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Text(app.t("Version", "Version"))
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Text(version)
                            .font(.mono(12))
                            .foregroundStyle(Theme.muted)
                    }
                    Divider().overlay(Theme.line)
                    HStack {
                        Text(app.t("Schreib-Endpunkt", "Write endpoint"))
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Text("/api/tools")
                            .font(.mono(11))
                            .foregroundStyle(Theme.muted)
                    }
                    Divider().overlay(Theme.line)
                    HStack {
                        Text(app.t("MCP-Endpunkt", "MCP endpoint"))
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.ink)
                        Spacer()
                        Text("/api/mcp")
                            .font(.mono(11))
                            .foregroundStyle(Theme.muted)
                    }
                    Divider().overlay(Theme.line)
                    Button(role: .destructive) {
                        app.forgetServer()
                    } label: {
                        Label(app.t("Gespeicherte Adresse löschen", "Forget saved address"), systemImage: "trash")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(Theme.clay)
                    }
                }
            }
        }
    }
}