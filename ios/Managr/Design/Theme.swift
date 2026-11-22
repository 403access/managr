import SwiftUI

extension Color {
    init(hex: UInt32, alpha: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: alpha
        )
    }
}

enum Theme {
    static let paper = Color(hex: 0xEFEAE0)
    static let ink = Color(hex: 0x1C2430)
    static let pine = Color(hex: 0x0E5C52)
    static let pineDeep = Color(hex: 0x0A3F38)
    static let clay = Color(hex: 0x9C3B2E)
    static let moss = Color(hex: 0x2F6B3A)
    static let amber = Color(hex: 0x8A5A12)
    static let muted = Color(hex: 0x5C6570)
    static let line = Color(hex: 0xD9D1C3)
    static let card = Color(hex: 0xF7F3EB)
}

extension Font {
    static func display(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .serif)
    }

    static func mono(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
}

enum Tone {
    case neutral
    case ink
    case pine
    case moss
    case amber
    case clay

    var color: Color {
        switch self {
        case .neutral: return Theme.muted
        case .ink: return Theme.ink
        case .pine: return Theme.pine
        case .moss: return Theme.moss
        case .amber: return Theme.amber
        case .clay: return Theme.clay
        }
    }

    static func forStatus(_ status: String) -> Tone {
        switch status {
        case "paid", "done", "active", "achieved": return .moss
        case "draft", "void", "open": return .neutral
        case "overdue", "missing", "missed": return .clay
        case "partial", "doing": return .pine
        case "paused", "requested": return .amber
        default: return .neutral
        }
    }
}

struct Pill: View {
    let text: String
    var tone: Tone = .neutral

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .semibold))
            .textCase(.uppercase)
            .tracking(0.4)
            .foregroundStyle(tone.color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.color.opacity(0.12), in: Capsule())
    }
}

struct Panel<Content: View>: View {
    var padding: CGFloat = 16
    @ViewBuilder var content: Content

    var body: some View {
        content
            .padding(padding)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Theme.line, lineWidth: 1)
            )
    }
}

struct SectionHeading: View {
    let title: String
    var detail: String?

    var body: some View {
        HStack(alignment: .firstTextBaseline) {
            Text(title)
                .font(.display(20))
                .foregroundStyle(Theme.ink)
            Spacer()
            if let detail {
                Text(detail)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
        }
    }
}

struct MetricTile: View {
    let label: String
    let value: String
    var detail: String?
    var tone: Tone = .neutral

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.system(size: 11, weight: .medium))
                .textCase(.uppercase)
                .tracking(0.5)
                .foregroundStyle(Theme.muted)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(value)
                .font(.mono(19, weight: .semibold))
                .foregroundStyle(tone.color)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            if let detail {
                Text(detail)
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                    .lineLimit(2)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .topLeading)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(Theme.line, lineWidth: 1)
        )
    }
}

struct EmptyState: View {
    let icon: String
    let title: String
    var message: String?

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 28))
                .foregroundStyle(Theme.muted.opacity(0.7))
            Text(title)
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(Theme.ink)
            if let message {
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.muted)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 28)
        .padding(.horizontal, 20)
    }
}

struct InlineError: View {
    let message: String
    var retry: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.clay)
            VStack(alignment: .leading, spacing: 6) {
                Text(message)
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                if let retry {
                    Button("Erneut versuchen", action: retry)
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Theme.pine)
                }
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(Theme.clay.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}

struct DeskBackground: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Theme.paper.ignoresSafeArea())
    }
}

extension View {
    func deskBackground() -> some View {
        modifier(DeskBackground())
    }
}

struct AmountText: View {
    let cents: Int?
    var size: CGFloat = 15
    var tone: Tone = .neutral

    var body: some View {
        Text(Format.euro(cents))
            .font(.mono(size, weight: .semibold))
            .foregroundStyle(tone.color)
    }
}