import Foundation

// MARK: - Shell

struct Shell: Decodable {
    let legalName: String
    let legalForm: String
    let isSample: Bool
    let activeCompanyId: Int
    let companies: [CompanyRef]
}

struct CompanyRef: Decodable, Identifiable, Hashable {
    let id: Int
    let legalName: String
    let legalForm: String
}

// MARK: - Desk

struct Desk: Decodable {
    let legalName: String
    let today: String
    let bankCents: Int
    let receivablesCents: Int
    let profitBeforeTaxCents: Int
    let fyLabel: String
    let gap: ReserveGap
    let kleinNotes: [String]
    let invoices: [DeskInvoice]
    let dates: [DeskDate]
    let tasks: [DeskTask]
    let weekStart: String
    let weekEnd: String
    let minutes: Int
    let analytics: DeskAnalytics
}

struct ReserveGap: Decodable {
    let targetCents: Int
    let coveredCents: Int
    let gapCents: Int
    let dutyActive: Bool
}

struct DeskInvoice: Decodable, Identifiable {
    let id: Int
    let customerName: String
    let number: String?
    let dueDate: String
    let openCents: Int
    let displayStatus: String
}

struct DeskDate: Decodable, Identifiable {
    let due: String
    let title: String
    let href: String
    let tone: String

    var id: String { "\(due)-\(title)" }
}

struct DeskTask: Decodable, Identifiable {
    let id: Int
    let title: String
    let dueDate: String?
    let status: String
}

struct DeskAnalytics: Decodable {
    let minutes: Int
    let productiveShare: Int
    let billableMinutes: Int
    let projectCounts: ProjectCounts
    let projectRows: [DeskProjectRow]
    let typeRows: [DeskTypeRow]
    let deliverables: Int
    let openDeliverables: Int
}

struct ProjectCounts: Decodable {
    let started: Int
    let completed: Int
    let active: Int
    let paused: Int
}

struct DeskProjectRow: Decodable, Identifiable {
    let minutes: Int
    let productiveMinutes: Int
    let unproductiveMinutes: Int
    let billableMinutes: Int
    let projectId: Int?
    let name: String
    let customerId: Int?
    let customerName: String?
    let status: String
    let unassigned: Bool

    var id: String { "\(projectId ?? 0)-\(name)" }
}

struct DeskTypeRow: Decodable, Identifiable {
    let taskType: String
    let minutes: Int
    let productive: Bool
    let taskCount: Int

    var id: String { taskType }
}

// MARK: - Invoices

struct InvoicesResponse: Decodable {
    let invoices: [InvoiceSummary]
}

struct InvoiceSummary: Decodable, Identifiable {
    let id: Int
    let number: String?
    let status: String
    let issueDate: String
    let dueDate: String
    let customerId: Int
    let customerName: String
    let netCents: Int
    let vatCents: Int
    let grossCents: Int
    let paidCents: Int
    let openCents: Int
    let displayStatus: String
}

struct InvoiceDetailResponse: Decodable {
    let invoice: InvoiceRecord
    let company: Company
    let customer: CustomerRecord
    let lines: [InvoiceLine]
    let payments: [InvoicePayment]
    let netCents: Int
    let vatCents: Int
    let grossCents: Int
    let byRate: [InvoiceRateRow]
    let paidCents: Int
    let openCents: Int
    let displayStatus: String
    let blockers: [String]
    let eInvoiceBlockers: [String]
    let today: String
}

struct InvoiceRecord: Decodable {
    let id: Int
    let companyId: Int
    let customerId: Int
    let number: String?
    let status: String
    let issueDate: String
    let serviceDate: String
    let dueDate: String
    let notes: String
    let exemptionNote: String
    let buyerReference: String
    let amountDisplay: String
    let journalEntryId: Int?
    let deletedAt: String?
}

struct InvoiceLine: Decodable, Identifiable {
    let id: Int
    let invoiceId: Int
    let position: Int
    let description: String
    let quantityMilli: Int
    let unitNetCents: Int
    let vatBps: Int
    let netCents: Int
    let entryDate: String?
}

struct InvoicePayment: Decodable, Identifiable {
    let id: Int
    let invoiceId: Int
    let paidOn: String
    let amountCents: Int
    let journalEntryId: Int?
}

struct InvoiceRateRow: Decodable, Identifiable {
    let vatBps: Int
    let netCents: Int
    let vatCents: Int

    var id: Int { vatBps }
}

struct Company: Decodable {
    let id: Int
    let legalName: String
    let legalForm: String
    let street: String
    let postalCode: String
    let city: String
    let country: String
    let taxNumber: String
    let vatId: String
    let iban: String
    let bic: String
    let bankName: String
    let email: String
    let phone: String
    let website: String
    let invoicePrefix: String
    let nextInvoiceSeq: Int
    let paymentTermsDays: Int
    let kleinunternehmer: Bool
    let defaultVatBps: Int
    let hourlyRateCents: Int?
}

// MARK: - Customers

struct CustomersResponse: Decodable {
    let customers: [Customer]
}

/// The customer row as stored, without the aggregate totals of the customer list.
struct CustomerRecord: Decodable {
    let id: Int
    let companyId: Int
    let name: String
    let street: String
    let postalCode: String
    let city: String
    let country: String
    let email: String
    let website: String
    let vatId: String
    let buyerReference: String
    let hourlyRateCents: Int?
}

struct Customer: Decodable, Identifiable, Hashable {
    let id: Int
    let companyId: Int
    let name: String
    let street: String
    let postalCode: String
    let city: String
    let country: String
    let email: String
    let website: String
    let vatId: String
    let buyerReference: String
    let hourlyRateCents: Int?
    let projectCount: Int
    let minutes: Int
    let billableMinutes: Int
    let billableValueCents: Int
    let invoiceCount: Int
    let revenueCents: Int
    let openCents: Int
    let lastActivity: String?
}

// MARK: - Time

struct TimeResponse: Decodable {
    let anchor: String
    let today: String
    let start: String
    let end: String
    let previous: String
    let next: String
    let entries: [TimeEntry]
    let total: Int
    let billableTotal: Int
    let billableValueCents: Int
    let globalHourlyRateCents: Int?
    let people: [PersonRef]
    let contacts: [ContactRef]
    let tasks: [TaskItem]
    let projects: [ProjectRef]
}

struct TimeEntry: Decodable, Identifiable {
    let id: Int
    let entryDate: String
    let startedAt: String
    let endedAt: String
    let breakMinutes: Int
    let memo: String
    let activities: [String]
    let billable: Bool
    let taskId: Int?
    let employeeId: Int?
    let contactId: Int?
    let contactName: String
    let projectId: Int?
    let projectName: String
    let customerId: Int?
    let customerName: String
    let taskType: String
    let personName: String
    let minutes: Int
    let warnings: [TimeWarning]
    let error: String
    let hourlyRateCents: Int?
    let rate: RateSource?
    let valueCents: Int
}

struct TimeWarning: Decodable {
    let level: String
    let message: String
}

struct RateSource: Decodable {
    let cents: Int
    let source: String
}

struct PersonRef: Decodable, Identifiable {
    let id: Int
    let firstName: String
    let lastName: String
}

struct ContactRef: Decodable, Identifiable {
    let id: Int
    let firstName: String
    let lastName: String
    let role: String
    let customerId: Int?
    let customerName: String
}

struct ProjectRef: Decodable, Identifiable {
    let id: Int
    let name: String
    let customerId: Int?
    let customerName: String?
    let hourlyRateCents: Int?
}

// MARK: - Projects

struct ProjectsResponse: Decodable {
    let today: String
    let globalHourlyRateCents: Int?
    let projects: [Project]
}

struct Project: Decodable, Identifiable {
    let id: Int
    let customerId: Int?
    let customerName: String?
    let name: String
    let status: String
    let startedOn: String
    let endedOn: String?
    let notes: String
    let hourlyRateCents: Int?
    let minutes: Int
    let effectiveRate: RateSource?
    let valueCents: Int
    let taskCount: Int
    let openTasks: Int
    let deliverables: Int
    let openDeliverables: Int
}

// MARK: - Tasks

struct TaskItem: Decodable, Identifiable {
    let id: Int
    let title: String
    let notes: String?
    let status: String
    let dueDate: String?
    let area: String?
    let projectId: Int?
    let taskType: String?
    let deliverable: Bool?
    let completedAt: String?
}

// MARK: - Obligations

struct ObligationsResponse: Decodable {
    let year: Int
    let today: String
    let reminders: [PolicyReminder]
    let due: [Obligation]
    let later: [Obligation]
    let deadlines: [CustomDeadline]
}

struct Obligation: Decodable, Identifiable {
    let key: String
    let title: String
    let category: String
    let dueDate: String
    let detail: String
    let when: String
    let status: String
    let note: String

    var id: String { key }
}

struct CustomDeadline: Decodable, Identifiable {
    let id: Int
    let title: String
    let dueDate: String
    let category: String
    let recurrence: String
    let status: String
    let notes: String?
}

struct PolicyReminder: Decodable, Identifiable {
    let label: String
    let renewalDate: String
    let overdue: Bool

    var id: String { "\(label)-\(renewalDate)" }
}

// MARK: - People

struct PeopleResponse: Decodable {
    let people: [Person]
}

struct Person: Decodable, Identifiable {
    let id: Int
    let firstName: String
    let lastName: String
    let role: String
    let kind: String
    let endDate: String?
    let grossMonthlyCents: Int
    let shortfall: String?
    let estimateError: String
    let regime: String

    var name: String {
        "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
    }
}