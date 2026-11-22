import SwiftUI

struct InvoicesView: View {
    @Environment(AppState.self) private var app
    @State private var invoices: [InvoiceSummary] = []
    @State private var error: String?
    @State private var search = ""
    @State private var filter: InvoiceFilter = .all

    enum InvoiceFilter: String, CaseIterable {
        case all
        case open
        case draft
        case paid

        @MainActor
        func title(_ app: AppState) -> String {
            switch self {
            case .all: return app.t("Alle", "All")
            case .open: return app.t("Offen", "Open")
            case .draft: return app.t("Entwurf", "Draft")
            case .paid: return app.t("Bezahlt", "Paid")
            }
        }
    }

    private var filtered: [InvoiceSummary] {
        let byStatus: [InvoiceSummary]
        switch filter {
        case .all:
            byStatus = invoices
        case .open:
            byStatus = invoices.filter { ["open", "overdue", "partial"].contains($0.displayStatus) }
        case .draft:
            byStatus = invoices.filter { $0.displayStatus == "draft" }
        case .paid:
            byStatus = invoices.filter { $0.displayStatus == "paid" }
        }
        let needle = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return byStatus }
        return byStatus.filter {
            $0.customerName.lowercased().contains(needle)
                || ($0.number ?? "").lowercased().contains(needle)
        }
    }

    private var openTotal: Int {
        invoices
            .filter { ["open", "overdue", "partial"].contains($0.displayStatus) }
            .reduce(0) { $0 + $1.openCents }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(app.t("Offen gesamt", "Open total"))
                            .font(.system(size: 11, weight: .medium))
                            .textCase(.uppercase)
                            .tracking(0.5)
                            .foregroundStyle(Theme.muted)
                        Text(Format.euro(openTotal))
                            .font(.mono(24, weight: .semibold))
                            .foregroundStyle(openTotal > 0 ? Theme.amber : Theme.ink)
                    }
                    Spacer()
                    Text("\(filtered.count)")
                        .font(.mono(13))
                        .foregroundStyle(Theme.muted)
                }

                Picker("", selection: $filter) {
                    ForEach(InvoiceFilter.allCases, id: \.self) { item in
                        Text(item.title(app)).tag(item)
                    }
                }
                .pickerStyle(.segmented)

                if filtered.isEmpty {
                    Panel {
                        EmptyState(
                            icon: "doc.text",
                            title: app.t("Keine Rechnungen", "No invoices"),
                            message: search.isEmpty ? app.t("In diesem Filter ist nichts.", "Nothing matches this filter.") : app.t("Keine Treffer für „\(search)“.", "No matches for “\(search)”.")
                        )
                    }
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { invoice in
                            NavigationLink(value: invoice.id) {
                                InvoiceRow(invoice: invoice)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .searchable(text: $search, prompt: app.t("Kunde oder Nummer", "Customer or number"))
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(app.t("Rechnungen", "Invoices"))
        .navigationBarTitleDisplayMode(.large)
        .navigationDestination(for: Int.self) { id in
            InvoiceDetailView(invoiceId: id)
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let response: InvoicesResponse = try await client.view("invoices")
            invoices = response.invoices
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}

struct InvoiceRow: View {
    @Environment(AppState.self) private var app
    let invoice: InvoiceSummary

    var body: some View {
        Panel(padding: 14) {
            VStack(alignment: .leading, spacing: 9) {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(invoice.customerName)
                            .font(.system(size: 15, weight: .medium))
                            .foregroundStyle(Theme.ink)
                            .lineLimit(1)
                        Text(invoice.number ?? app.t("ohne Nummer", "no number"))
                            .font(.mono(11))
                            .foregroundStyle(Theme.muted)
                    }
                    Spacer(minLength: 4)
                    Pill(text: Status.label(invoice.displayStatus, app.locale), tone: Tone.forStatus(invoice.displayStatus))
                }

                HStack(alignment: .firstTextBaseline) {
                    Text(app.t("gestellt \(Format.date(invoice.issueDate))", "issued \(Format.date(invoice.issueDate))"))
                        .font(.system(size: 11))
                        .foregroundStyle(Theme.muted)
                    Spacer()
                    Text("\(app.t("offen", "open")) \(Format.euro(invoice.openCents))")
                        .font(.mono(13, weight: .semibold))
                        .foregroundStyle(invoice.openCents > 0 ? Theme.ink : Theme.moss)
                }

                HStack {
                    Text(app.t("fällig \(Format.date(invoice.dueDate))", "due \(Format.date(invoice.dueDate))"))
                        .font(.system(size: 11))
                        .foregroundStyle(invoice.displayStatus == "overdue" ? Theme.clay : Theme.muted)
                    Spacer()
                    Text(Format.euro(invoice.grossCents))
                        .font(.mono(11))
                        .foregroundStyle(Theme.muted)
                }
            }
        }
    }
}