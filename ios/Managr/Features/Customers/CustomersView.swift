import SwiftUI

struct CustomersView: View {
    @Environment(AppState.self) private var app
    @State private var customers: [Customer] = []
    @State private var error: String?
    @State private var search = ""
    @State private var showAdd = false

    private var filtered: [Customer] {
        let needle = search.trimmingCharacters(in: .whitespaces).lowercased()
        guard !needle.isEmpty else { return customers }
        return customers.filter {
            $0.name.lowercased().contains(needle)
                || $0.city.lowercased().contains(needle)
                || $0.email.lowercased().contains(needle)
        }
    }

    private var openTotal: Int {
        customers.reduce(0) { $0 + $1.openCents }
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
                        Text(app.t("Offen bei Kunden", "Open at customers"))
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

                if filtered.isEmpty {
                    Panel {
                        EmptyState(
                            icon: "building.2",
                            title: app.t("Keine Kunden", "No customers"),
                            message: search.isEmpty ? app.t("Lege den ersten Kunden an.", "Add the first customer.") : app.t("Keine Treffer.", "No matches.")
                        )
                    }
                } else {
                    LazyVStack(spacing: 10) {
                        ForEach(filtered) { customer in
                            NavigationLink(value: customer) {
                                customerRow(customer)
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
        .searchable(text: $search, prompt: app.t("Name, Ort oder E-Mail", "Name, city or email"))
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(app.t("Kunden", "Customers"))
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showAdd = true
                } label: {
                    Image(systemName: "plus")
                        .foregroundStyle(Theme.pine)
                }
                .accessibilityLabel(app.t("Kunde anlegen", "Add customer"))
            }
        }
        .navigationDestination(for: Customer.self) { customer in
            CustomerDetailView(customer: customer)
        }
        .sheet(isPresented: $showAdd) {
            CustomerFormView(customer: nil)
                .environment(app)
        }
    }

    private func customerRow(_ customer: Customer) -> some View {
        Panel(padding: 14) {
            HStack(alignment: .center, spacing: 10) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(customer.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(Theme.ink)
                        .lineLimit(1)
                    Text("\(customer.postalCode) \(customer.city)".trimmingCharacters(in: .whitespaces))
                        .font(.system(size: 12))
                        .foregroundStyle(Theme.muted)
                    HStack(spacing: 10) {
                        if customer.projectCount > 0 {
                            Label("\(customer.projectCount)", systemImage: "folder")
                        }
                        if customer.minutes > 0 {
                            Label(Format.minutes(customer.minutes), systemImage: "clock")
                        }
                    }
                    .font(.system(size: 11))
                    .foregroundStyle(Theme.muted)
                }
                Spacer(minLength: 4)
                VStack(alignment: .trailing, spacing: 4) {
                    Text(Format.euro(customer.openCents))
                        .font(.mono(14, weight: .semibold))
                        .foregroundStyle(customer.openCents > 0 ? Theme.amber : Theme.ink)
                    Text(app.t("offen", "open"))
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.muted)
                }
                Image(systemName: "chevron.right")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.muted.opacity(0.6))
            }
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            let response: CustomersResponse = try await client.view("customers")
            customers = response.customers
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}

struct CustomerDetailView: View {
    @Environment(AppState.self) private var app
    let customer: Customer

    @State private var invoices: [InvoiceSummary] = []
    @State private var projects: [Project] = []
    @State private var error: String?
    @State private var showEdit = false

    private var customerInvoices: [InvoiceSummary] {
        invoices.filter { $0.customerId == customer.id }
            .sorted { $0.issueDate > $1.issueDate }
    }

    private var customerProjects: [Project] {
        projects.filter { $0.customerId == customer.id }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if let error {
                    InlineError(message: error) {
                        Task { await load() }
                    }
                }

                header
                metrics
                contact
                invoicesSection
                projectsSection
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
            .padding(.bottom, 28)
        }
        .deskBackground()
        .refreshable { await load() }
        .task(id: app.dataVersion) { await load() }
        .navigationTitle(customer.name)
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(for: Int.self) { id in
            InvoiceDetailView(invoiceId: id)
        }
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button(app.t("Bearbeiten", "Edit")) {
                    showEdit = true
                }
                .foregroundStyle(Theme.pine)
            }
        }
        .sheet(isPresented: $showEdit) {
            CustomerFormView(customer: customer)
                .environment(app)
        }
    }

    private var header: some View {
        Panel {
            VStack(alignment: .leading, spacing: 6) {
                Text(customer.name)
                    .font(.display(24))
                    .foregroundStyle(Theme.ink)
                if !customer.street.isEmpty {
                    Text(customer.street)
                        .font(.system(size: 13))
                        .foregroundStyle(Theme.ink)
                }
                Text("\(customer.postalCode) \(customer.city)".trimmingCharacters(in: .whitespaces))
                    .font(.system(size: 13))
                    .foregroundStyle(Theme.ink)
                Text(customer.country)
                    .font(.system(size: 12))
                    .foregroundStyle(Theme.muted)
                if !customer.vatId.isEmpty {
                    Text("USt-IdNr. \(customer.vatId)")
                        .font(.mono(11))
                        .foregroundStyle(Theme.muted)
                        .padding(.top, 2)
                }
                if let rate = customer.hourlyRateCents {
                    Text(app.t("Stundensatz \(Format.euro(rate))", "Hourly rate \(Format.euro(rate))"))
                        .font(.mono(11))
                        .foregroundStyle(Theme.pine)
                        .padding(.top, 2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var metrics: some View {
        LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
            MetricTile(label: app.t("Offen", "Open"), value: Format.euro(customer.openCents), detail: app.t("\(customer.invoiceCount) Rechnungen", "\(customer.invoiceCount) invoices"), tone: customer.openCents > 0 ? .amber : .neutral)
            MetricTile(label: app.t("Umsatz", "Revenue"), value: Format.euro(customer.revenueCents), detail: app.t("gestellt", "issued"), tone: .moss)
            MetricTile(label: app.t("Zeit", "Time"), value: Format.minutes(customer.minutes), detail: app.t("\(customer.projectCount) Projekte", "\(customer.projectCount) projects"), tone: .pine)
            MetricTile(label: app.t("Leistbarer Wert", "Billable value"), value: Format.euro(customer.billableValueCents), detail: Format.minutes(customer.billableMinutes), tone: .neutral)
        }
    }

    @ViewBuilder
    private var contact: some View {
        if !customer.email.isEmpty || !customer.website.isEmpty {
            Panel {
                VStack(alignment: .leading, spacing: 10) {
                    if !customer.email.isEmpty, let url = URL(string: "mailto:\(customer.email)") {
                        Link(destination: url) {
                            Label(customer.email, systemImage: "envelope")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.pine)
                        }
                    }
                    if !customer.website.isEmpty, let url = URL(string: customer.website) {
                        Link(destination: url) {
                            Label(customer.website, systemImage: "globe")
                                .font(.system(size: 13))
                                .foregroundStyle(Theme.pine)
                                .lineLimit(1)
                        }
                    }
                    if let last = customer.lastActivity {
                        Label(app.t("Letzte Aktivität \(Format.date(last))", "Last activity \(Format.date(last))"), systemImage: "calendar")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.muted)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder
    private var invoicesSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: app.t("Rechnungen", "Invoices"), detail: "\(customerInvoices.count)")
            if customerInvoices.isEmpty {
                Panel {
                    EmptyState(icon: "doc.text", title: app.t("Noch keine Rechnung", "No invoices yet"))
                }
            } else {
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(customerInvoices.enumerated()), id: \.element.id) { index, invoice in
                            NavigationLink(value: invoice.id) {
                                HStack(alignment: .firstTextBaseline, spacing: 8) {
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(invoice.number ?? app.t("ohne Nummer", "no number"))
                                            .font(.mono(12, weight: .medium))
                                            .foregroundStyle(Theme.ink)
                                        Text("\(Format.date(invoice.issueDate)) · \(Format.date(invoice.dueDate))")
                                            .font(.system(size: 11))
                                            .foregroundStyle(Theme.muted)
                                    }
                                    Spacer()
                                    Pill(text: Status.label(invoice.displayStatus, app.locale), tone: Tone.forStatus(invoice.displayStatus))
                                    Text(Format.euro(invoice.grossCents))
                                        .font(.mono(12, weight: .semibold))
                                        .foregroundStyle(Theme.ink)
                                    Image(systemName: "chevron.right")
                                        .font(.system(size: 10, weight: .semibold))
                                        .foregroundStyle(Theme.muted.opacity(0.6))
                                }
                                .padding(.horizontal, 14)
                                .padding(.vertical, 11)
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            if index < customerInvoices.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 14)
                            }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var projectsSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            SectionHeading(title: app.t("Projekte", "Projects"), detail: "\(customerProjects.count)")
            if customerProjects.isEmpty {
                Panel {
                    EmptyState(icon: "folder", title: app.t("Noch kein Projekt", "No projects yet"))
                }
            } else {
                Panel(padding: 0) {
                    VStack(spacing: 0) {
                        ForEach(Array(customerProjects.enumerated()), id: \.element.id) { index, project in
                            HStack(spacing: 8) {
                                VStack(alignment: .leading, spacing: 3) {
                                    Text(project.name)
                                        .font(.system(size: 13, weight: .medium))
                                        .foregroundStyle(Theme.ink)
                                    Text("\(Format.minutes(project.minutes)) · \(Format.euro(project.valueCents))")
                                        .font(.system(size: 11))
                                        .foregroundStyle(Theme.muted)
                                }
                                Spacer()
                                Pill(text: Status.label(project.status, app.locale), tone: Tone.forStatus(project.status))
                            }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 11)
                            if index < customerProjects.count - 1 {
                                Divider().overlay(Theme.line).padding(.leading, 14)
                            }
                        }
                    }
                }
            }
        }
    }

    private func load() async {
        guard let client = app.client else { return }
        do {
            async let invoiceResponse: InvoicesResponse = client.view("invoices")
            async let projectResponse: ProjectsResponse = client.view("projects")
            let (loadedInvoices, loadedProjects) = try await (invoiceResponse, projectResponse)
            invoices = loadedInvoices.invoices
            projects = loadedProjects.projects
            error = nil
        } catch {
            self.error = app.friendly(error)
        }
    }
}

struct CustomerFormView: View {
    @Environment(AppState.self) private var app
    @Environment(\.dismiss) private var dismiss
    let customer: Customer?

    @State private var name: String
    @State private var street: String
    @State private var postalCode: String
    @State private var city: String
    @State private var email: String
    @State private var website: String
    @State private var vatId: String
    @State private var hourlyRate: String
    @State private var error: String?
    @State private var busy = false

    init(customer: Customer?) {
        self.customer = customer
        _name = State(initialValue: customer?.name ?? "")
        _street = State(initialValue: customer?.street ?? "")
        _postalCode = State(initialValue: customer?.postalCode ?? "")
        _city = State(initialValue: customer?.city ?? "")
        _email = State(initialValue: customer?.email ?? "")
        _website = State(initialValue: customer?.website ?? "")
        _vatId = State(initialValue: customer?.vatId ?? "")
        _hourlyRate = State(initialValue: customer?.hourlyRateCents.map { Format.euroInput($0) } ?? "")
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(app.t("Kunde", "Customer")) {
                    TextField(app.t("Name", "Name"), text: $name)
                        .textContentType(.organizationName)
                    TextField(app.t("Straße", "Street"), text: $street)
                    TextField(app.t("PLZ", "Postal code"), text: $postalCode)
                        .keyboardType(.numbersAndPunctuation)
                    TextField(app.t("Ort", "City"), text: $city)
                    TextField(app.t("E-Mail", "Email"), text: $email)
                        .keyboardType(.emailAddress)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    TextField(app.t("Website", "Website"), text: $website)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                }

                Section {
                    TextField(app.t("USt-IdNr.", "VAT id"), text: $vatId)
                        .textInputAutocapitalization(.characters)
                        .autocorrectionDisabled()
                    TextField(app.t("Stundensatz in Euro", "Hourly rate in euro"), text: $hourlyRate)
                        .keyboardType(.decimalPad)
                } header: {
                    Text(app.t("Abrechnung", "Billing"))
                } footer: {
                    Text(app.t("Der Stundensatz gilt, wenn Projekt und Eintrag keinen eigenen haben.", "The rate applies when neither the project nor the entry has its own."))
                }

                if let error {
                    Section {
                        Text(error)
                            .font(.system(size: 13))
                            .foregroundStyle(Theme.clay)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.paper)
            .navigationTitle(customer == nil ? app.t("Kunde anlegen", "Add customer") : app.t("Kunde bearbeiten", "Edit customer"))
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
                            Text(app.t("Speichern", "Save")).fontWeight(.semibold)
                        }
                    }
                    .disabled(busy || name.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    private func save() async {
        guard let client = app.client else { return }
        busy = true
        defer { busy = false }
        var args: [String: JSONValue] = [
            "name": .string(name.trimmingCharacters(in: .whitespaces)),
            "street": .string(street),
            "postalCode": .string(postalCode),
            "city": .string(city),
            "email": .string(email),
            "website": .string(website),
            "vatId": .string(vatId)
        ]
        if let customer {
            args["customerId"] = .int(customer.id)
        }
        if !hourlyRate.trimmingCharacters(in: .whitespaces).isEmpty {
            args["hourlyRate"] = .string(hourlyRate.trimmingCharacters(in: .whitespaces))
        } else if customer != nil {
            args["hourlyRate"] = .string("")
        }
        do {
            _ = try await client.run("save_customer", args)
            app.didChange()
            dismiss()
        } catch {
            self.error = app.friendly(error)
        }
    }
}