import Foundation

enum Status {
    static func label(_ status: String, _ locale: AppLocale) -> String {
        let de: String
        let en: String
        switch status {
        case "draft": de = "Entwurf"; en = "Draft"
        case "issued": de = "Gestellt"; en = "Issued"
        case "open": de = "Offen"; en = "Open"
        case "overdue": de = "Überfällig"; en = "Overdue"
        case "partial": de = "Teilweise"; en = "Partial"
        case "paid": de = "Bezahlt"; en = "Paid"
        case "void": de = "Storniert"; en = "Void"
        case "done": de = "Erledigt"; en = "Done"
        case "doing": de = "In Arbeit"; en = "Doing"
        case "active": de = "Aktiv"; en = "Active"
        case "paused": de = "Pausiert"; en = "Paused"
        case "achieved": de = "Erreicht"; en = "Achieved"
        case "missed": de = "Verpasst"; en = "Missed"
        case "skipped": de = "Übersprungen"; en = "Skipped"
        case "planned": de = "Geplant"; en = "Planned"
        case "requested": de = "Beantragt"; en = "Requested"
        default: de = status.capitalized; en = status.capitalized
        }
        return locale == .de ? de : en
    }

    static func kind(_ kind: String, _ locale: AppLocale) -> String {
        let de: String
        let en: String
        switch kind {
        case "regular": de = "Angestellt"; en = "Employed"
        case "minijob": de = "Minijob"; en = "Minijob"
        case "midijob": de = "Midijob"; en = "Midijob"
        case "apprentice": de = "Ausbildung"; en = "Apprentice"
        case "managing_director": de = "Geschäftsführung"; en = "Managing director"
        default: de = kind.replacingOccurrences(of: "_", with: " ").capitalized
            en = kind.replacingOccurrences(of: "_", with: " ").capitalized
        }
        return locale == .de ? de : en
    }
}