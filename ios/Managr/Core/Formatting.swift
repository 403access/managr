import Foundation

enum Format {
    static let german = Locale(identifier: "de_DE")

    private static let euroFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = "EUR"
        formatter.locale = Locale(identifier: "de_DE")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    private static let plainFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "de_DE")
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = false
        return formatter
    }()

    private static let quantityFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.locale = Locale(identifier: "de_DE")
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 3
        return formatter
    }()

    private static let isoParser: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let isoPrinter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let displayDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "dd.MM.yyyy"
        return formatter
    }()

    private static let longDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "EEEE, d. MMMM yyyy"
        return formatter
    }()

    private static let weekday: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "de_DE")
        formatter.dateFormat = "EEE, dd.MM."
        return formatter
    }()

    private static let clock: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "HH:mm"
        return formatter
    }()

    static func euro(_ cents: Int?) -> String {
        guard let cents else { return "—" }
        return euroFormatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "—"
    }

    /// The value a tool expects, for example "1017,50".
    static func euroInput(_ cents: Int) -> String {
        plainFormatter.string(from: NSNumber(value: Double(cents) / 100)) ?? "0,00"
    }

    static func quantity(_ milli: Int) -> String {
        quantityFormatter.string(from: NSNumber(value: Double(milli) / 1000)) ?? "0"
    }

    static func date(_ iso: String?) -> String {
        guard let iso, let date = isoParser.date(from: iso) else { return "—" }
        return displayDate.string(from: date)
    }

    static func dateLong(_ iso: String?) -> String {
        guard let iso, let date = isoParser.date(from: iso) else { return "—" }
        return longDate.string(from: date)
    }

    static func weekdayShort(_ iso: String?) -> String {
        guard let iso, let date = isoParser.date(from: iso) else { return "—" }
        return weekday.string(from: date)
    }

    static func iso(from date: Date) -> String {
        isoPrinter.string(from: date)
    }

    static func parseIso(_ iso: String) -> Date? {
        isoParser.date(from: iso)
    }

    static func clock(from date: Date) -> String {
        clock.string(from: date)
    }

    static func minutes(_ total: Int) -> String {
        if total <= 0 { return "0 min" }
        let hours = total / 60
        let minutes = total % 60
        if hours == 0 { return "\(minutes) min" }
        if minutes == 0 { return "\(hours) h" }
        return "\(hours) h \(minutes) min"
    }

    static func hours(_ total: Int) -> String {
        let hours = Double(total) / 60
        return String(format: "%.1f h", hours).replacingOccurrences(of: ".", with: ",")
    }

    static func percent(_ value: Int) -> String {
        "\(value) %"
    }

    static func daysUntil(_ iso: String, from today: String = Format.iso(from: Date())) -> Int? {
        guard let target = isoParser.date(from: iso), let start = isoParser.date(from: today) else { return nil }
        let calendar = Calendar(identifier: .gregorian)
        return calendar.dateComponents([.day], from: start, to: target).day
    }

    static func dueLabel(_ iso: String, today: String, locale: AppLocale) -> String {
        guard let days = daysUntil(iso, from: today) else { return date(iso) }
        if locale == .de {
            if days < 0 { return "\(abs(days)) Tage überfällig" }
            if days == 0 { return "heute fällig" }
            if days == 1 { return "morgen fällig" }
            return "in \(days) Tagen"
        }
        if days < 0 { return "\(abs(days)) days overdue" }
        if days == 0 { return "due today" }
        if days == 1 { return "due tomorrow" }
        return "in \(days) days"
    }

    static func vatLabel(_ bps: Int) -> String {
        let percent = Double(bps) / 100
        let text = percent == percent.rounded() ? String(Int(percent)) : String(format: "%.1f", percent).replacingOccurrences(of: ".", with: ",")
        return "\(text) %"
    }

    static func taskType(_ key: String, _ locale: AppLocale) -> String {
        let de: String
        let en: String
        switch key {
        case "development": de = "Entwicklung"; en = "Development"
        case "design": de = "Design"; en = "Design"
        case "planning": de = "Planung"; en = "Planning"
        case "research": de = "Research"; en = "Research"
        case "documentation": de = "Dokumentation"; en = "Documentation"
        case "meeting": de = "Meeting"; en = "Meeting"
        case "communication": de = "Kommunikation"; en = "Communication"
        case "admin", "administration": de = "Verwaltung"; en = "Administration"
        case "other": de = "Sonstiges"; en = "Other"
        default: de = key; en = key
        }
        return locale == .de ? de : en
    }
}