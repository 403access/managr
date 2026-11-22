import SwiftUI

struct ConnectView: View {
    @Environment(AppState.self) private var app
    @State private var draft = ""
    @FocusState private var addressFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header

                Panel {
                    VStack(alignment: .leading, spacing: 12) {
                        Text(app.t("Adresse des Schreibtischs", "Desk address"))
                            .font(.system(size: 12, weight: .semibold))
                            .textCase(.uppercase)
                            .tracking(0.5)
                            .foregroundStyle(Theme.muted)

                        TextField("192.168.1.20:3000", text: $draft)
                            .textFieldStyle(.plain)
                            .font(.mono(16))
                            .keyboardType(.URL)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .submitLabel(.go)
                            .focused($addressFocused)
                            .onSubmit(connect)
                            .padding(12)
                            .background(Color.white.opacity(0.6), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .stroke(addressFocused ? Theme.pine : Theme.line, lineWidth: 1)
                            )

                        Button(action: connect) {
                            HStack(spacing: 8) {
                                if app.isConnecting {
                                    ProgressView()
                                        .tint(.white)
                                }
                                Text(app.isConnecting ? app.t("Verbinde …", "Connecting …") : app.t("Verbinden", "Connect"))
                                    .font(.system(size: 15, weight: .semibold))
                            }
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .foregroundStyle(.white)
                            .background(Theme.pine, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        }
                        .disabled(draft.trimmingCharacters(in: .whitespaces).isEmpty || app.isConnecting)
                        .opacity(draft.trimmingCharacters(in: .whitespaces).isEmpty ? 0.55 : 1)

                        if let error = app.lastError, !error.isEmpty {
                            InlineError(message: error)
                        }
                    }
                }

                if !app.recentServers.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(app.t("Zuletzt benutzt", "Recently used"))
                            .font(.system(size: 12, weight: .semibold))
                            .textCase(.uppercase)
                            .tracking(0.5)
                            .foregroundStyle(Theme.muted)
                        ForEach(app.recentServers, id: \.self) { address in
                            Button {
                                draft = address
                                connect()
                            } label: {
                                HStack {
                                    Image(systemName: "desktopcomputer")
                                        .foregroundStyle(Theme.pine)
                                    Text(address)
                                        .font(.mono(14))
                                        .foregroundStyle(Theme.ink)
                                    Spacer()
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(Theme.muted)
                                }
                                .padding(12)
                                .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .stroke(Theme.line, lineWidth: 1)
                                )
                            }
                        }
                    }
                }

                howTo
            }
            .padding(.horizontal, 20)
            .padding(.top, 28)
            .padding(.bottom, 40)
        }
        .deskBackground()
        .scrollDismissesKeyboard(.interactively)
        .onAppear {
            if draft.isEmpty {
                draft = app.serverAddress
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("managr")
                .font(.display(44))
                .foregroundStyle(Theme.pine)
            Text(app.t("Dein Schreibtisch auf dem iPhone.", "Your desk on the iPhone."))
                .font(.system(size: 16))
                .foregroundStyle(Theme.ink)
            Text(app.t(
                "Die App verbindet sich direkt mit dem Schreibtisch auf deinem Computer. Nichts geht an einen Cloud-Dienst.",
                "The app connects straight to the desk on your computer. Nothing goes to a cloud service."
            ))
            .font(.system(size: 13))
            .foregroundStyle(Theme.muted)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var howTo: some View {
        Panel {
            VStack(alignment: .leading, spacing: 12) {
                Text(app.t("So findest du die Adresse", "How to find the address"))
                    .font(.display(18))
                    .foregroundStyle(Theme.ink)

                step(1, app.t("Starte den Schreibtisch auf dem Mac:", "Start the desk on the Mac:"))
                Text("bun run dev")
                    .font(.mono(13))
                    .foregroundStyle(Theme.pineDeep)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.white.opacity(0.7), in: RoundedRectangle(cornerRadius: 8, style: .continuous))

                step(2, app.t("Nimm die Zeile **Network** aus der Ausgabe, zum Beispiel `http://192.168.1.20:3000`.", "Take the **Network** line from the output, for example `http://192.168.1.20:3000`."))
                step(3, app.t("iPhone und Mac müssen im selben WLAN sein. Beim ersten Verbinden fragt iOS nach dem lokalen Netzwerk – erlaube es.", "The iPhone and Mac must be on the same Wi-Fi. On the first connection iOS asks for local-network access – allow it."))

                Text(app.t("Tipp: Auf dem Mac zeigt `ipconfig getifaddr en0` die Adresse im WLAN.", "Tip: on the Mac, `ipconfig getifaddr en0` prints the Wi-Fi address."))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
        }
    }

    private func step(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(.white)
                .frame(width: 20, height: 20)
                .background(Theme.pine, in: Circle())
            Text(.init(text))
                .font(.system(size: 13))
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
        }
    }

    private func connect() {
        addressFocused = false
        let address = draft
        Task { await app.connect(to: address) }
    }
}