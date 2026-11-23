import SwiftUI

struct DashboardView: View {
    @Environment(AppState.self) private var app
    @State private var desk: Desk?
    @State private var error: String?
    @State private var actionError: String?
    @State private var busyTask: Int?
    @State private var showAssistant = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header

                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                if let desk {
                    metrics(desk)
                    if let due = desk.dates.first(where: { $0.tone == "overdue" }) {
                        overdueBanner(due, count: desk.dates.filter { $0.tone == "overdue" }.count, desk: desk)
                    }
                    invoiceSection(desk)
                    datesSection(desk)
                    taskSection(desk)
                    weekSection(desk)
                } else if error == nil {
                    ProgressView()
                        .tint(Theme.pine)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 60)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                companyMenu
            }
            ToolbarItemGroup(placement: .topBarTrailing) {
                Button {
                    showAssistant = true
                } label: {
                    Image(systemName: "sparkles")
                        .foregroundStyle(Theme.pine)
                }
                .accessibilityLabel(app.t("Assistent öffnen", "Open assistant"))

                Button {
                    Task { await load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                        .foregroundStyle(Theme.pine)
                }
                .accessibilityLabel(app.t("Aktualisieren", "Refresh"))
            }
        }
        .navigationDestination(for: Int.self) { id in
            InvoiceDetailView(invoiceId: id)
        }
        .sheet(isPresented: $showAssistant) {
            NavigationStack {
                AssistantView(onClose: { showAssistant = false })
            }
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(desk?.legalName ?? app.activeCompanyName)
                .font(.display(26))
                .foregroundStyle(Theme.ink)
            if let desk {
                Text(Format.dateLong(desk.today))
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var companyMenu: some View {
        Menu {
            ForEach(app.companies) { company in
                Button {
                    Task { await app.switchCompany(to: company.id) }
                } label: {
                    if company.id == app.shell?.activeCompanyId {
                        Label(company.legalName, systemImage: "checkmark")
                    } else {
                        Text(company.legalName)
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .fill(Theme.pine)
                    .frame(width: 7, height: 7)
                Text(app.activeCompanyName)
                    .font(.system(size: 13, weight: .medium))
                    .lineLimit(1)
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(Theme.pineDeep)
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Theme.card, in: Capsule())
            .overlay(Capsule().stroke(Theme.line, lineWidth: 1))
        }
    }

    @ViewBuilder
    private func metrics(_ desk: Desk) -> some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            MetricTile(
                label: app.t("Bank", "Bank"),
                value: Format.euro(desk.bankCents),
                detail: app.t("Kontostand", "Account balance"),
                tone: desk.bankCents < 0 ? .clay : .pine
            )
            MetricTile(
                label: app.t("Forderungen", "Receivables"),
                value: Format.euro(desk.receivablesCents),
                detail: app.t("offen bei Kunden", "open at customers"),
                tone: desk.receivablesCents > 0 ? .amber : .neutral
            )
            MetricTile(
                label: app.t("Gewinn vor Steuern", "Profit before tax"),
                value: Format.euro(desk.profitBeforeTaxCents),
                detail: app.t("Wirtschaftsjahr \(desk.fyLabel)", "Fiscal year \(desk.fyLabel)"),
                tone: desk.profitBeforeTaxCents < 0 ? .clay : .moss
            )
            MetricTile(
                label: app.t("Woche", "Week"),
                value: Format.minutes(desk.minutes),
                detail: app.t("Jahr · \(Format.minutes(desk.analytics.billableMinutes)) leistbar", "Year · \(Format.minutes(desk.analytics.billableMinutes)) billable"),
                tone: .pine
            )
        }
    }

    private func overdueBanner(_ first: DeskDate, count: Int, desk: Desk) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.clay)
            VStack(alignment: .leading, spacing: 3) {
                Text(count == 1 ? app.t("Eine Frist ist überfällig", "One deadline is overdue") : app.t("Überfällige Fristen", "Overdue deadlines"))
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Theme.ink)
                Text("\(first.title) · \(Format.date(first.due))")
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
            }
            Spacer(minLength: 0)
            NavigationLink {
                ObligationsView()
            } label: {
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Theme.clay)
            }
        }
        .padding(12)
        .background(Theme.clay.opacity(0.08), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    @ViewBuilder
    private func invoiceSection(_ desk: Desk) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(
                title: app.t("Offene Rechnungen", "Open invoices"),
                detail: desk.invoices.isEmpty ? nil : "\(desk.invoices.count)"
            )
            if desk.invoices.isEmpty {
                Panel {
                    EmptyState(
                        icon: "checkmark.seal",
                        title: app.t("Nichts offen", "Nothing open"),
                        message: app.t("Alle Rechnungen sind bezahlt.", "All invoices are paid.")
                    )
                }
            } else {
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(desk.invoices.enumerated()), id: \.element.id) { index, invoice in
                            NavigationLink(value: invoice.id) {
                                invoiceRow(invoice)
                            }
                            .buttonStyle(.plain)
                            if index < desk.invoices.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 14)
                            }
                        }
                    }
                }
            }
        }
    }

    private func invoiceRow(_ invoice: DeskInvoice) -> some View {
        HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 5) {
                Text(invoice.customerName)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundStyle(Theme.ink)
                    .lineLimit(1)
                HStack(spacing: 6) {
                    Pill(text: Status.label(invoice.displayStatus, app.locale), tone: Tone.forStatus(invoice.displayStatus))
                    Text(invoice.number ?? app.t("ohne Nummer", "no number"))
                        .font(.mono(11))
                        .foregroundStyle(Theme.muted)
                }
            }
            Spacer(minLength: 4)
            VStack(alignment: .trailing, spacing: 4) {
                AmountText(cents: invoice.openCents, size: 14, tone: .ink)
                Text(Format.date(invoice.dueDate))
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
            }
            Image(systemName: "chevron.right")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Theme.muted.opacity(0.6))
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .contentShape(Rectangle())
    }

    @ViewBuilder
    private func datesSection(_ desk: Desk) -> some View {
        if !desk.dates.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeading(title: app.t("Nächste Fristen", "Next deadlines"), detail: app.t("45 Tage", "45 days"))
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(desk.dates.enumerated()), id: \.element.id) { index, item in
                            HStack(alignment: .top, spacing: 10) {
                                Circle()
                                    .fill(item.tone == "overdue" ? Theme.clay : Theme.amber)
                                    .frame(width: 7, height: 7)
                                    .padding(.top, 5)
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(item.title)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                    Text("\(Format.date(item.due)) · \(Format.dueLabel(item.due, today: desk.today, locale: app.locale))")
                                        .font(.system(size: 11))
                                        .foregroundStyle(item.tone == "overdue" ? Theme.clay : Theme.muted)
                                }
                                Spacer(minLength: 0)
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            if index < desk.dates.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 30)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func taskSection(_ desk: Desk) -> some View {
        if !desk.tasks.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                SectionHeading(title: app.t("Aufgaben", "Tasks"), detail: "\(desk.tasks.count)")
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(desk.tasks.enumerated()), id: \.element.id) { index, task in
                            HStack(spacing: 10) {
                                Button {
                                    Task { await toggle(task) }
                                } label: {
                                    Image(systemName: task.status == "done" ? "checkmark.circle.fill" : "circle")
                                        .font(.system(size: 20))
                                        .foregroundStyle(task.status == "done" ? Theme.moss : Theme.muted)
                                }
                                .buttonStyle(.plain)
                                .disabled(busyTask == task.id)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(task.title)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                        .strikethrough(task.status == "done")
                                    if let due = task.dueDate {
                                        Text(Format.date(due))
                                            .font(.system(size: 11))
                                            .foregroundStyle(Theme.muted)
                                    }
                                }
                                Spacer(minLength: 0)
                                if busyTask == task.id {
                                    ProgressView().tint(Theme.pine)
                                }
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            if index < desk.tasks.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 44)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func weekSection(_ desk: Desk) -> some View {
        let analytics = desk.analytics
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: app.t("Zeit diese Woche", "Time this week"), detail: "\(Format.date(desk.weekStart)) – \(Format.date(desk.weekEnd))")
            Panel {
                VStack(alignment: .leading, spacing: 14) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(Format.minutes(desk.minutes))
                            .font(.mono(24, weight: .semibold))
                            .foregroundStyle(Theme.pine)
                        Spacer()
                        Text(app.t("\(analytics.productiveShare) % produktiv", "\(analytics.productiveShare) % productive"))
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                    }

                    GeometryReader { proxy in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Theme.line.opacity(0.5))
                            Capsule()
                                .fill(Theme.pine)
                                .frame(width: max(6, proxy.size.width * CGFloat(min(100, analytics.productiveShare)) / 100))
                        }
                    }
                    .frame(height: 7)

                    if !analytics.projectRows.isEmpty {
                        VStack(spacing: 8) {
                            ForEach(analytics.projectRows) { row in
                                HStack(spacing: 8) {
                                    Text(row.name)
                                        .font(.system(size: 12))
                                        .foregroundStyle(Theme.ink)
                                        .lineLimit(1)
                                    Spacer(minLength: 4)
                                    Text(Format.minutes(row.minutes))
                                        .font(.mono(11))
                                        .foregroundStyle(Theme.muted)
                                }
                            }
                        }
                    }

                    HStack(spacing: 16) {
                        Label("\(analytics.projectCounts.active) \(app.t("aktiv", "active"))", systemImage: "folder")
                        Label("\(analytics.openDeliverables) \(app.t("offen", "open"))", systemImage: "shippingbox")
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                }
            }
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let loaded: Desk = try await client.view("desk")
            desk = loaded
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }

    private func toggle(_ task: DeskTask) async {
        guard let client = app.client else { return }
        busyTask = task.id
        defer { busyTask = nil }
        let next = task.status == "done" ? "open" : "done"
        do {
            _ = try await client.run("set_task_status", ["taskId": .int(task.id), "status": .string(next)])
            app.didChange()
        } catch {
            actionError = app.friendly(error)
        }
    }
}