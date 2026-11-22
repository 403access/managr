import Foundation
import Observation

enum AppLocale: String {
    case de
    case en
}

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case failed(String)
}

@MainActor
@Observable
final class AppState {
    private enum Keys {
        static let server = "managr.server"
        static let recent = "managr.recentServers"
        static let locale = "managr.locale"
    }

    private let defaults = UserDefaults.standard

    var shell: Shell?
    var client: DeskClient?
    var connection: ConnectionState = .disconnected
    var serverAddress: String
    var localeCode: String
    var recentServers: [String]
    var lastError: String?
    /// Bumped after every write so open screens reload their view.
    var dataVersion = 0

    init() {
        let saved = UserDefaults.standard.string(forKey: Keys.server) ?? ""
        serverAddress = saved
        let savedLocale = UserDefaults.standard.string(forKey: Keys.locale)
        if savedLocale == "de" || savedLocale == "en" {
            localeCode = savedLocale ?? "de"
        } else {
            localeCode = Locale.preferredLanguages.first?.hasPrefix("de") == true ? "de" : "en"
        }
        recentServers = UserDefaults.standard.stringArray(forKey: Keys.recent) ?? []
    }

    var locale: AppLocale {
        localeCode == "en" ? .en : .de
    }

    func t(_ de: String, _ en: String) -> String {
        locale == .de ? de : en
    }

    var isConnected: Bool {
        if case .connected = connection { return true }
        return false
    }

    var isConnecting: Bool {
        if case .connecting = connection { return true }
        return false
    }

    var serverDisplay: String {
        client.map { ServerAddress.display($0.baseURL) } ?? serverAddress
    }

    var companies: [CompanyRef] {
        shell?.companies ?? []
    }

    var activeCompany: CompanyRef? {
        companies.first { $0.id == shell?.activeCompanyId }
    }

    var activeCompanyName: String {
        activeCompany?.legalName ?? shell?.legalName ?? ""
    }

    @discardableResult
    func connect(to raw: String, remember: Bool = true) async -> Bool {
        guard let url = ServerAddress.normalize(raw) else {
            connection = .failed(t("Die Adresse ist ungültig. Beispiel: 192.168.1.20:3000", "That address is invalid. Example: 192.168.1.20:3000"))
            return false
        }
        connection = .connecting
        lastError = nil
        let candidate = DeskClient(baseURL: url)
        do {
            let shell: Shell = try await candidate.view("shell")
            client = candidate
            self.shell = shell
            serverAddress = ServerAddress.display(url)
            connection = .connected
            if remember {
                defaults.set(serverAddress, forKey: Keys.server)
                addRecent(serverAddress)
            }
            dataVersion += 1
            return true
        } catch {
            client = nil
            shell = nil
            let text = friendly(error)
            connection = .failed(text)
            lastError = text
            return false
        }
    }

    func autoConnect() async {
        guard client == nil, !serverAddress.isEmpty else { return }
        _ = await connect(to: serverAddress, remember: false)
    }

    func refreshShell() async {
        guard let client else { return }
        do {
            shell = try await client.view("shell")
        } catch {
            lastError = friendly(error)
        }
    }

    func switchCompany(to id: Int) async {
        guard let client, id != shell?.activeCompanyId else { return }
        do {
            _ = try await client.run("switch_company", ["companyId": .int(id)])
            await refreshShell()
            dataVersion += 1
        } catch {
            lastError = friendly(error)
        }
    }

    func didChange() {
        dataVersion += 1
    }

    func disconnect() {
        client = nil
        shell = nil
        connection = .disconnected
        lastError = nil
    }

    func forgetServer() {
        defaults.removeObject(forKey: Keys.server)
        serverAddress = ""
        disconnect()
    }

    func setLocale(_ locale: AppLocale) {
        localeCode = locale.rawValue
        defaults.set(localeCode, forKey: Keys.locale)
    }

    func addRecent(_ address: String) {
        var updated = recentServers.filter { $0 != address }
        updated.insert(address, at: 0)
        recentServers = Array(updated.prefix(4))
        defaults.set(recentServers, forKey: Keys.recent)
    }

    func friendly(_ error: Error) -> String {
        if let desk = error as? DeskError {
            switch desk {
            case .invalidAddress:
                return t("Die Adresse ist ungültig.", "That address is invalid.")
            case .transport:
                return t(
                    "Der Schreibtisch antwortet nicht. Läuft `bun run dev`, und sind iPhone und Mac im selben WLAN?",
                    "The desk is not answering. Is `bun run dev` running, and are the iPhone and Mac on the same Wi-Fi?"
                )
            case .server(let status, let message):
                if status == 404 {
                    return t("Diese Ansicht gibt es auf dem Schreibtisch nicht. Ist die App auf dem neuesten Stand?", "The desk does not serve this view. Is the app up to date?")
                }
                return message.isEmpty ? "HTTP \(status)" : message
            case .tool(let message):
                return message
            case .decoding:
                return t("Die Antwort des Schreibtischs konnte nicht gelesen werden.", "The desk's answer could not be read.")
            }
        }
        if let urlError = error as? URLError {
            switch urlError.code {
            case .cannotConnectToHost, .cannotFindHost, .networkConnectionLost, .timedOut:
                return t(
                    "Der Schreibtisch ist nicht erreichbar. Prüfe die Adresse und das WLAN.",
                    "The desk is unreachable. Check the address and the Wi-Fi."
                )
            case .notConnectedToInternet:
                return t("Keine Netzwerkverbindung.", "No network connection.")
            default:
                return urlError.localizedDescription
            }
        }
        return error.localizedDescription
    }

    /// A short, human-readable status for the settings screen.
    var connectionSummary: String {
        switch connection {
        case .connected:
            return t("Verbunden", "Connected")
        case .connecting:
            return t("Verbinde …", "Connecting …")
        case .failed(let message):
            return message
        case .disconnected:
            return t("Nicht verbunden", "Not connected")
        }
    }
}