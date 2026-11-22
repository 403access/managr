import Foundation

enum DeskError: LocalizedError {
    case invalidAddress
    case transport(String)
    case server(Int, String)
    case tool(String)
    case decoding(String)

    var errorDescription: String? {
        switch self {
        case .invalidAddress:
            return "invalidAddress"
        case .transport(let message):
            return message
        case .server(let status, let message):
            return message.isEmpty ? "HTTP \(status)" : message
        case .tool(let message):
            return message
        case .decoding(let message):
            return message
        }
    }

    var isUnreachable: Bool {
        if case .transport = self { return true }
        return false
    }
}

/// Talks to the Next.js desk on the local network.
///
/// Reads use `/api/views/[name]`, writes use `/api/tools`, which runs the same
/// validated tool registry the assistant and MCP clients use.
struct DeskClient: Sendable {
    let baseURL: URL
    private let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 20
        configuration.timeoutIntervalForResource = 60
        configuration.waitsForConnectivity = false
        configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
        self.session = URLSession(configuration: configuration)
    }

    func view<T: Decodable>(_ name: String, query: [URLQueryItem] = [], as type: T.Type = T.self) async throws -> T {
        let request = try makeRequest(path: "api/views/\(name)", query: query)
        return try await send(request)
    }

    @discardableResult
    func run(_ name: String, _ arguments: [String: JSONValue] = [:]) async throws -> JSONValue {
        let body = try JSONEncoder().encode(ToolRequest(name: name, arguments: arguments))
        var request = try makeRequest(path: "api/tools")
        request.httpMethod = "POST"
        request.httpBody = body
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let envelope: ToolEnvelope = try await send(request)
        guard envelope.ok else {
            throw DeskError.tool(envelope.error ?? "The tool failed.")
        }
        return envelope.data ?? .null
    }

    func call<T: Decodable>(_ name: String, _ arguments: [String: JSONValue] = [:], as type: T.Type) async throws -> T {
        let value = try await run(name, arguments)
        do {
            return try value.decoded(type)
        } catch {
            throw DeskError.decoding("The answer from \(name) could not be read.")
        }
    }

    private func makeRequest(path: String, query: [URLQueryItem] = []) throws -> URLRequest {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw DeskError.invalidAddress
        }
        let basePath = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let extraPath = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let joined = [basePath, extraPath].filter { !$0.isEmpty }.joined(separator: "/")
        components.path = joined.isEmpty ? "/" : "/" + joined
        if !query.isEmpty {
            components.queryItems = query
        }
        guard let url = components.url else { throw DeskError.invalidAddress }
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return request
    }

    private func send<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch let error as URLError {
            throw DeskError.transport(error.localizedDescription)
        } catch {
            throw DeskError.transport(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else {
            throw DeskError.transport("The desk did not answer.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let apiError = try? JSONDecoder().decode(APIError.self, from: data)
            let text = apiError?.error ?? String(data: data.prefix(400), encoding: .utf8) ?? ""
            throw DeskError.server(http.statusCode, text)
        }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            throw DeskError.decoding("The desk sent an unexpected answer.")
        }
    }
}

private struct ToolRequest: Encodable {
    let name: String
    let arguments: [String: JSONValue]
}

private struct ToolEnvelope: Decodable {
    let ok: Bool
    let data: JSONValue?
    let error: String?
}

private struct APIError: Decodable {
    let error: String?
}

enum ServerAddress {
    /// Accepts "192.168.1.20", "192.168.1.20:3000", "mac.local:3000",
    /// or a full URL, and fills in http and port 3000 when they are missing.
    static func normalize(_ raw: String) -> URL? {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        if !text.contains("://") {
            text = "http://" + text
        }
        guard var components = URLComponents(string: text),
              let scheme = components.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              components.host?.isEmpty == false else {
            return nil
        }
        if components.port == nil {
            components.port = 3000
        }
        components.path = components.path.replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        return components.url
    }

    static func display(_ url: URL) -> String {
        var text = url.absoluteString
        if text.hasSuffix("/") { text.removeLast() }
        return text
    }
}