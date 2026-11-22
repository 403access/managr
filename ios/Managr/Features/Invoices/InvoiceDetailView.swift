import SwiftUI

struct InvoiceDetailView: View {
    @Environment(AppState.self) private var app
    let invoiceId: Int

    @State private var detail: InvoiceDetailResponse?
    @State private var error: String?
    @State private var actionError: String?
    @State private var successMessage: String?
    @State private var busy = false
    @State private var showIssueConfirm = false
    @State private var showPayment = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                if let detail {
                    header(detail)
                    blockers(detail)
                    lines(detail)
                    payments(detail)
                    recipient(detail)
                    notes(detail)
                } else if error == nil {
                    ProgressView()
                        .tint(Theme.pine)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 30)
        }
        .deskBackground()
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(detail?.invoice.number ?? app.t("Rechnung", "Invoice"))
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            if let detail, showsAction(detail) {
                actionBar(detail)
            }
        }
        .confirmationDialog(
            app.t("Rechnung ausstellen?", "Issue invoice?"),
            isPresented: $showIssueConfirm,
            titleVisibility: .visible
        ) {
            Button(app.t("Ausstellen", "Issue")) {
                Task { await issue() }
            }
            Button(app.t("Abbrechen", "Cancel"), role: .cancel) {}
        } message: {
            Text(app.t("Die Rechnung bekommt die nächste Nummer und wird als Forderung gebucht.", "The invoice gets the next number and is posted as a receivable."))
        }
        .sheet(isPresented: $showPayment) {
            if let detail {
                PaymentSheet(invoiceId: detail.invoice.id, openCents: detail.openCents, today: detail.today) {
                    Task { await load() }
                }
                .environment(app)
            }
        }
        .alert(app.t("Hinweis", "Notice"), isPresented: Binding(
            get: { successMessage != nil },
            set: { if !$0 { successMessage = nil } }
        )) {
            Button("OK", role: .cancel) { successMessage = nil }
        } message: {
            Text(successMessage ?? "")
        }
        .alert(app.t("Aktion fehlgeschlagen", "Action failed"), isPresented: Binding(
            get: { actionError != nil },
            set: { if !$0 { actionError = nil } }
        )) {
            Button("OK", role: .cancel) { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    // MARK: - Sections

    private func header(_ detail: InvoiceDetailResponse) -> some View {
        Panel {
            VStack(alignment: .leading, spacing: 14) {
                HStack(alignment: .top, spacing: 8) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(detail.customer.name)
                            .font(.display(22))
                            .foregroundStyle(Theme.ink)
                        Text(detail.invoice.number ?? app.t("Entwurf, noch nicht nummeriert", "Draft, not numbered yet"))
                            .font(.mono(12))
                            .foregroundStyle(Theme.muted)
                    }
                    Spacer(minLength: 4)
                    Pill(text: Status.label(detail.displayStatus, app.locale), tone: Tone.forStatus(detail.displayStatus))
                }

                Divider().overlay(Theme.line)

                HStack(alignment: .firstTextBaseline) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(app.t("Offen", "Open"))
                            .font(.system(size: 11, weight: .medium))
                            .textCase(.uppercase)
                            .tracking(0.4)
                            .foregroundStyle(Theme.muted)
                        Text(Format.euro(detail.openCents))
                            .font(.mono(26, weight: .semibold))
                            .foregroundStyle(detail.openCents > 0 ? Theme.clay : Theme.moss)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 3) {
                        Text(app.t("Brutto", "Gross"))
                            .font(.system(size: 11, weight: .medium))
                            .textCase(.uppercase)
                            .tracking(0.4)
                            .foregroundStyle(Theme.muted)
                        Text(Format.euro(detail.grossCents))
                            .font(.mono(17, weight: .semibold))
                            .foregroundStyle(Theme.ink)
                    }
                }

                HStack(spacing: 0) {
                    infoCell(app.t("Netto", "Net"), Format.euro(detail.netCents))
                    infoCell(app.t("USt.", "VAT"), Format.euro(detail.vatCents))
                    infoCell(app.t("Bezahlt", "Paid"), Format.euro(detail.paidCents))
                }

                Divider().overlay(Theme.line)

                HStack(spacing: 0) {
                    infoCell(app.t("Gestellt", "Issued"), Format.date(detail.invoice.issueDate))
                    infoCell(app.t("Leistung", "Service"), Format.date(detail.invoice.serviceDate))
                    infoCell(app.t("Fällig", "Due"), Format.date(detail.invoice.dueDate))
                }
            }
        }
    }

    private func infoCell(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.system(size: 10, weight: .medium))
                .textCase(.uppercase)
                .tracking(0.4)
                .foregroundStyle(Theme.muted)
            Text(value)
                .font(.mono(12, weight: .medium))
                .foregroundStyle(Theme.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private func blockers(_ detail: InvoiceDetailResponse) -> some View {
        if !detail.blockers.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Label(app.t("Vor dem Ausstellen fehlt", "Missing before issuing"), systemImage: "exclamationmark.triangle.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.clay)
                ForEach(detail.blockers, id: \.self) { item in
                    Text("• \(item)")
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.ink)
                }
            }
            .padding(12)
            .background(Theme.clay.opacity(0.08), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }

        if !detail.eInvoiceBlockers.isEmpty, detail.invoice.status != "draft" {
            DisclosureGroup {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(detail.eInvoiceBlockers, id: \.self) { item in
                        Text("• \(item)")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                    }
                }
                .padding(.top, 6)
            } label: {
                Label(app.t("Hinweise zur E-Rechnung", "E-invoice notes"), systemImage: "info.circle")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.pine)
            }
            .padding(12)
            .background(Theme.pine.opacity(0.05), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private func lines(_ detail: InvoiceDetailResponse) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: app.t("Positionen", "Line items"), detail: "\(detail.lines.count)")
            Panel(padding: 0) {
                VStack(spacing: 0) {
                    ForEach(Array(detail.lines.enumerated()), id: \.element.id) { index, line in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline) {
                                Text("\(line.position).")
                                    .font(.mono(11))
                                    .foregroundStyle(Theme.muted)
                                    .frame(width: 22, alignment: .trailing)
                                Text(line.description)
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.ink)
                                    .fixedSize(horizontal: false, vertical: true)
                                Spacer(minLength: 0)
                            }
                            HStack(spacing: 6) {
                                Text("\(Format.quantity(line.quantityMilli)) × \(Format.euro(line.unitNetCents))")
                                    .font(.mono(11))
                                    .foregroundStyle(Theme.muted)
                                if line.vatBps > 0 {
                                    Text("+ \(Format.vatLabel(line.vatBps)) USt.")
                                        .font(.mono(11))
                                        .foregroundStyle(Theme.muted)
                                }
                                Spacer()
                                Text(Format.euro(line.netCents))
                                    .font(.mono(12, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                            }
                            .padding(.leading, 30)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 11)
                        if index < detail.lines.count - 1 {
                            Divider().overlay(Theme.line).padding(.leading, 14)
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func payments(_ detail: InvoiceDetailResponse) -> some View {
        if !detail.payments.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeading(title: app.t("Zahlungen", "Payments"), detail: "\(detail.payments.count)")
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(detail.payments.enumerated()), id: \.element.id) { index, payment in
                            HStack {
                                Label(Format.date(payment.paidOn), systemImage: "checkmark.circle.fill")
                                    .font(.system(size: 13))
                                    .foregroundStyle(Theme.moss)
                                Spacer()
                                Text(Format.euro(payment.amountCents))
                                    .font(.mono(13, weight: .semibold))
                                    .foregroundStyle(Theme.ink)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            if index < detail.payments.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 14)
                            }
                        }
                    }
                }
            }
        }
    }

    private func recipient(_ detail: InvoiceDetailResponse) -> some View {
        Panel {
            VStack(alignment: .leading, spacing: 4) {
                Text(app.t("Rechnungsempfänger", "Bill to"))
                    .font(.system(size: 11, weight: .medium))
                    .textCase(.uppercase)
                    .tracking(0.4)
                    .foregroundStyle(Theme.muted)
                Text(detail.customer.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                if !detail.customer.street.isEmpty {
                    Text(detail.customer.street)
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
                Text("\(detail.customer.postalCode) \(detail.customer.city)".trimmingCharacters(in: .whitespaces))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                if !detail.customer.vatId.isEmpty {
                    Text("USt-IdNr. \(detail.customer.vatId)")
                        .font(.mono(11))
                        .foregroundStyle(Theme.muted)
                        .padding(.top, 2)
                }
                Divider().overlay(Theme.line).padding(.vertical, 6)
                Text(detail.company.legalName)
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Theme.ink)
                Text("\(detail.company.street), \(detail.company.postalCode) \(detail.company.city)")
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                if !detail.company.iban.isEmpty {
                    Text("IBAN \(detail.company.iban)")
                        .font(.mono(10))
                        .foregroundStyle(Theme.muted)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    @ViewBuilder
    private func notes(_ detail: InvoiceDetailResponse) -> some View {
        if !detail.invoice.notes.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(app.t("Notiz", "Note"))
                    .font(.system(size: 11, weight: .medium))
                    .textCase(.uppercase)
                    .tracking(0.4)
                    .foregroundStyle(Theme.muted)
                Text(detail.invoice.notes)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.ink)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.card, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    // MARK: - Actions

    private func showsAction(_ detail: InvoiceDetailResponse) -> Bool {
        switch detail.invoice.status {
        case "draft": return true
        case "issued": return detail.openCents > 0
        case "void", "paid": return false
        default: return detail.openCents > 0
        }
    }

    private func actionBar(_ detail: InvoiceDetailResponse) -> some View {
        VStack(spacing: 0) {
            Divider().overlay(Theme.line)
            Group {
                if detail.invoice.status == "draft" {
                    Button {
                        showIssueConfirm = true
                    } label: {
                        actionLabel(app.t("Rechnung ausstellen", "Issue invoice"), icon: "paperplane.fill")
                    }
                    .disabled(busy || !detail.blockers.isEmpty)
                    .opacity(detail.blockers.isEmpty ? 1 : 0.5)
                } else {
                    Button {
                        showPayment = true
                    } label: {
                        actionLabel(app.t("Zahlung erfassen", "Record payment"), icon: "eurosign.circle.fill")
                    }
                    .disabled(busy)
                }
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.top, 10)
            .padding(.bottom, 8)
        }
        .background(.ultraThinMaterial)
    }

    private func actionLabel(_ title: String, icon: String) -> some View {
        HStack(spacing: 8) {
            if busy {
                ProgressView().tint(.white)
            } else {
                Image(systemName: icon)
            }
            Text(title)
                .font(.system(size: 15, weight: .semibold))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 13)
        .foregroundStyle(.white)
        .background(Theme.pine, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
    }

    private func issue() async {
        guard let client = app.client else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await client.run("issue_invoice", ["invoiceId": .int(invoiceId)])
            await load()
            app.didChange()
            if let number = detail?.invoice.number {
                successMessage = app.t("Rechnung \(number) wurde gestellt und gebucht.", "Invoice \(number) was issued and posted.")
            }
        } catch {
            actionError = app.friendly(error)
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let loaded: InvoiceDetailResponse = try await client.view("invoice", query: [URLQueryItem(name: "id", value: "\(invoiceId)")])
            detail = loaded
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}

struct PaymentSheet: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let invoiceId: Int
    let openCents: Int
    let today: String
    var onSaved: () -> Void

    @State private var amount: String
    @State private var paidOn: Date
    @State private var error: String?
    @State private var busy = false

    init(invoiceId: Int, openCents: Int, today: String, onSaved: @escaping () -> Void) {
        self.invoiceId = invoiceId
        self.openCents = openCents
        self.today = today
        self.onSaved = onSaved
        _amount = State(initialValue: Format.euroInput(openCents))
        _paidOn = State(initialValue: Format.parseIso(today) ?? Date())
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        Text(app.t("Betrag", "Amount"))
                        Spacer()
                        TextField("0,00", text: $amount)
                            .font(.mono(17, weight: .semibold))
                            .multilineTextAlignment(.trailing)
                            .keyboardType(.decimalPad)
                    }
                    DatePicker(app.t("Zahlungsdatum", "Payment date"), selection: $paidOn, displayedComponents: .date)
                } footer: {
                    Text(app.t("Offen: \(Format.euro(openCents))", "Open: \(Format.euro(openCents))"))
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.clay)
                    }
                }

                Section {
                    Text(app.t("Die Zahlung wird als Bankeingang gebucht und die Rechnung als bezahlt oder teilweise bezahlt markiert.", "The payment is posted as a bank receipt and the invoice is marked paid or partially paid."))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .navigationTitle(app.t("Zahlung erfassen", "Record payment"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(app.t("Abbrechen", "Cancel")) { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy {
                            ProgressView().tint(Theme.pine)
                        } else {
                            Text(app.t("Buchen", "Post")).fontWeight(.semibold)
                        }
                    }
                    .disabled(busy || amount.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func save() async {
        guard let client = app.client else { return }
        busy = true
        defer { busy = false }
        do {
            _ = try await client.run("record_invoice_payment", [
                "invoiceId": .int(invoiceId),
                "amount": .string(amount.trimmingCharacters(in: .whitespaces)),
                "paidOn": .string(Format.iso(from: paidOn))
            ])
            app.didChange()
            onSaved()
            dismiss()
        } catch {
            self.error = app.friendly(error)
        }
    }
}