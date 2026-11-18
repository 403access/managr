import type { Locale } from "@/i18n";

/** Text that exists in both catalog languages. */
export type Localized = { de: string; en: string };

export function pick(value: Localized, locale: Locale): string {
  return value[locale];
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const SOURCE_IDS = [
  "aok",
  "arbeitsagentur",
  "bfdi",
  "bmas",
  "bmf",
  "bmg",
  "bmwk",
  "bundesanzeiger",
  "bundesregierung",
  "bzst",
  "dguv",
  "drv",
  "elster",
  "erechnung",
  "gesetze",
  "gkv",
  "handelsregister",
  "ihk",
  "mindestlohn",
  "sozialversicherung",
  "unternehmensregister",
  "xoev",
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export type Source = {
  id: SourceId;
  title: Localized;
  publisher: Localized;
  kind: Localized;
  note: Localized;
  url: string;
  domain: string;
};

type SourceSeed = Omit<Source, "domain">;

const sourceSeeds: SourceSeed[] = [
  {
    id: "aok",
    title: { de: "AOK – Die Gesundheitskasse", en: "AOK – Die Gesundheitskasse" },
    publisher: { de: "AOK", en: "AOK" },
    kind: { de: "Krankenkasse", en: "Health insurer" },
    note: {
      de: "Beiträge, Leistungen und Meldungen zur gesetzlichen Krankenversicherung.",
      en: "Contributions, benefits, and notifications for statutory health insurance.",
    },
    url: "https://www.aok.de/",
  },
  {
    id: "arbeitsagentur",
    title: { de: "Bundesagentur für Arbeit", en: "Federal Employment Agency" },
    publisher: { de: "Bundesagentur für Arbeit", en: "Federal Employment Agency" },
    kind: { de: "Bundesagentur", en: "Federal agency" },
    note: {
      de: "Arbeitsmarkt, Beschäftigung und Arbeitgeberservice.",
      en: "Labour market, employment, and employer services.",
    },
    url: "https://www.arbeitsagentur.de/",
  },
  {
    id: "bfdi",
    title: {
      de: "Bundesbeauftragte für den Datenschutz und die Informationsfreiheit",
      en: "Federal Commissioner for Data Protection and Freedom of Information",
    },
    publisher: { de: "BfDI", en: "BfDI" },
    kind: { de: "Aufsichtsbehörde", en: "Supervisory authority" },
    note: {
      de: "Datenschutz, DSGVO und Beschäftigtendatenschutz.",
      en: "Data protection, GDPR, and employee data.",
    },
    url: "https://www.bfdi.bund.de/",
  },
  {
    id: "bmas",
    title: { de: "Bundesministerium für Arbeit und Soziales", en: "Federal Ministry of Labour and Social Affairs" },
    publisher: { de: "BMAS", en: "BMAS" },
    kind: { de: "Ministerium", en: "Ministry" },
    note: {
      de: "Arbeitsrecht, Mindestlohn und soziale Sicherung.",
      en: "Labour law, minimum wage, and social security.",
    },
    url: "https://www.bmas.de/",
  },
  {
    id: "bmf",
    title: { de: "Bundesministerium der Finanzen", en: "Federal Ministry of Finance" },
    publisher: { de: "BMF", en: "BMF" },
    kind: { de: "Ministerium", en: "Ministry" },
    note: {
      de: "Steuerpolitik, GoBD und Schreiben zur Umsatzsteuer.",
      en: "Tax policy, GoBD, and VAT guidance.",
    },
    url: "https://www.bundesfinanzministerium.de/",
  },
  {
    id: "bmg",
    title: { de: "Bundesministerium für Gesundheit", en: "Federal Ministry of Health" },
    publisher: { de: "BMG", en: "BMG" },
    kind: { de: "Ministerium", en: "Ministry" },
    note: {
      de: "Kranken- und Pflegeversicherung.",
      en: "Statutory health and long-term care insurance.",
    },
    url: "https://www.bundesgesundheitsministerium.de/",
  },
  {
    id: "bmwk",
    title: { de: "Bundesministerium für Wirtschaft und Klimaschutz", en: "Federal Ministry for Economic Affairs and Climate Action" },
    publisher: { de: "BMWK", en: "BMWK" },
    kind: { de: "Ministerium", en: "Ministry" },
    note: {
      de: "Gründung, Mittelstand und Wirtschaftsförderung.",
      en: "Business formation, SMEs, and economic support.",
    },
    url: "https://www.bmwk.de/",
  },
  {
    id: "bundesanzeiger",
    title: { de: "Bundesanzeiger", en: "Federal Gazette" },
    publisher: { de: "Bundesanzeiger Verlag", en: "Bundesanzeiger Verlag" },
    kind: { de: "Verkündungsportal", en: "Publication portal" },
    note: {
      de: "Gesetzlich vorgeschriebene Veröffentlichungen und Offenlegungen.",
      en: "Statutory publications and disclosures.",
    },
    url: "https://www.bundesanzeiger.de/",
  },
  {
    id: "bundesregierung",
    title: { de: "Bundesregierung", en: "Federal Government" },
    publisher: { de: "Presse- und Informationsamt der Bundesregierung", en: "Press and Information Office of the Federal Government" },
    kind: { de: "Portal", en: "Portal" },
    note: {
      de: "Gesetzesvorhaben, Meldungen und Service der Bundesregierung.",
      en: "Legislative projects, news, and services of the Federal Government.",
    },
    url: "https://www.bundesregierung.de/",
  },
  {
    id: "bzst",
    title: { de: "Bundeszentralamt für Steuern", en: "Federal Central Tax Office" },
    publisher: { de: "BZSt", en: "BZSt" },
    kind: { de: "Bundesbehörde", en: "Federal authority" },
    note: {
      de: "Umsatzsteuer-Identifikationsnummer, Wirtschafts-ID und Bestätigungsverfahren.",
      en: "VAT identification number, business ID, and validation service.",
    },
    url: "https://www.bzst.de/",
  },
  {
    id: "dguv",
    title: { de: "Deutsche Gesetzliche Unfallversicherung", en: "German Social Accident Insurance" },
    publisher: { de: "DGUV", en: "DGUV" },
    kind: { de: "Unfallversicherung", en: "Accident insurer" },
    note: {
      de: "Berufsgenossenschaften, Arbeitsschutz und Unfallversicherung.",
      en: "Trade associations, occupational safety, and accident insurance.",
    },
    url: "https://www.dguv.de/",
  },
  {
    id: "drv",
    title: { de: "Deutsche Rentenversicherung", en: "German Pension Insurance" },
    publisher: { de: "Deutsche Rentenversicherung Bund", en: "German Pension Insurance Bund" },
    kind: { de: "Rentenversicherung", en: "Pension insurer" },
    note: {
      de: "Versicherungsnummer, Beiträge und Meldungen zur Rentenversicherung.",
      en: "Insurance number, contributions, and pension insurance notifications.",
    },
    url: "https://www.deutsche-rentenversicherung.de/",
  },
  {
    id: "elster",
    title: { de: "ELSTER – Das Online-Finanzamt", en: "ELSTER – The online tax office" },
    publisher: { de: "Bayerisches Landesamt für Steuern", en: "Bavarian State Tax Office" },
    kind: { de: "Steuerportal", en: "Tax portal" },
    note: {
      de: "Elektronische Übermittlung von Steuererklärungen und Voranmeldungen.",
      en: "Electronic filing of tax returns and advance returns.",
    },
    url: "https://www.elster.de/",
  },
  {
    id: "erechnung",
    title: { de: "eRechnung-Bund", en: "eRechnung-Bund" },
    publisher: { de: "Bundesministerium des Innern und für Heimat / BVA", en: "Federal Ministry of the Interior / BVA" },
    kind: { de: "Portal", en: "Portal" },
    note: {
      de: "E-Rechnung in der öffentlichen Verwaltung, Formate und Pflichten.",
      en: "E-invoicing in public administration, formats, and obligations.",
    },
    url: "https://www.e-rechnung-bund.de/",
  },
  {
    id: "gesetze",
    title: { de: "Gesetze im Internet", en: "Gesetze im Internet" },
    publisher: { de: "Bundesamt für Justiz", en: "Federal Office of Justice" },
    kind: { de: "Gesetzessammlung", en: "Statute collection" },
    note: {
      de: "Volltexte von Bundesgesetzen und Verordnungen, unter anderem UStG, HGB, GmbHG und ArbZG.",
      en: "Full texts of federal statutes and ordinances, including the VAT Act, Commercial Code, GmbH Act, and Working Hours Act.",
    },
    url: "https://www.gesetze-im-internet.de/",
  },
  {
    id: "gkv",
    title: { de: "GKV-Spitzenverband", en: "National Association of Statutory Health Insurance Funds" },
    publisher: { de: "GKV-Spitzenverband", en: "GKV-Spitzenverband" },
    kind: { de: "Spitzenverband", en: "National association" },
    note: {
      de: "Rechengrößen, Beitragssätze und gemeinsame Meldungen der gesetzlichen Krankenkassen.",
      en: "Calculation figures, contribution rates, and joint notifications of statutory health insurers.",
    },
    url: "https://www.gkv-spitzenverband.de/",
  },
  {
    id: "handelsregister",
    title: { de: "Handelsregister", en: "Commercial Register" },
    publisher: { de: "Bundesministerium der Justiz und die Länder", en: "Federal Ministry of Justice and the federal states" },
    kind: { de: "Register", en: "Register" },
    note: {
      de: "Registerauskünfte und Einsicht in Gesellschaftsdaten.",
      en: "Register extracts and company records.",
    },
    url: "https://www.handelsregister.de/",
  },
  {
    id: "ihk",
    title: { de: "IHK – Industrie- und Handelskammern", en: "IHK – Chambers of Industry and Commerce" },
    publisher: { de: "DIHK und die IHKs", en: "DIHK and the IHKs" },
    kind: { de: "Kammer", en: "Chamber" },
    note: {
      de: "Gründung, Aus- und Weiterbildung und betriebliche Pflichten.",
      en: "Business formation, training, and operational obligations.",
    },
    url: "https://www.ihk.de/",
  },
  {
    id: "mindestlohn",
    title: { de: "Mindestlohn", en: "Minimum wage" },
    publisher: { de: "BMAS", en: "BMAS" },
    kind: { de: "Informationsportal", en: "Information portal" },
    note: {
      de: "Aktueller Mindestlohn und Regeln für Arbeitgeber.",
      en: "Current minimum wage and rules for employers.",
    },
    url: "https://www.mindestlohn.de/",
  },
  {
    id: "sozialversicherung",
    title: { de: "Sozialversicherung kompakt", en: "Social insurance at a glance" },
    publisher: { de: "GKV, DRV, BA und weitere Träger", en: "GKV, DRV, BA, and other providers" },
    kind: { de: "Gemeinschaftsportal", en: "Joint portal" },
    note: {
      de: "Gemeinsame Auskünfte der Sozialversicherungsträger.",
      en: "Joint information from the social insurance providers.",
    },
    url: "https://www.sozialversicherung-kompetent.de/",
  },
  {
    id: "unternehmensregister",
    title: { de: "Unternehmensregister", en: "Company Register" },
    publisher: { de: "Bundesanzeiger Verlag", en: "Bundesanzeiger Verlag" },
    kind: { de: "Register", en: "Register" },
    note: {
      de: "Offenlegungen, Jahresabschlüsse und Unternehmensdaten.",
      en: "Disclosures, annual accounts, and company data.",
    },
    url: "https://www.unternehmensregister.de/",
  },
  {
    id: "xoev",
    title: { de: "XÖV – Koordinierungsstelle für IT-Standards", en: "XÖV – Coordination Office for IT Standards" },
    publisher: { de: "KoSIT", en: "KoSIT" },
    kind: { de: "Standardisierung", en: "Standardisation" },
    note: {
      de: "XRechnung-Spezifikation und europäische Norm EN 16931.",
      en: "XRechnung specification and European standard EN 16931.",
    },
    url: "https://www.xoev.de/",
  },
];

export const sources: Source[] = sourceSeeds.map((source) => ({ ...source, domain: domainOf(source.url) }));

export const sourceById = new Map<SourceId, Source>(sources.map((source) => [source.id, source]));

export const GUIDE_IDS = [
  "company",
  "customers",
  "invoice",
  "time",
  "obligations",
  "ledger",
  "person",
  "documents",
  "legal",
  "projects",
] as const;

export type GuideId = (typeof GUIDE_IDS)[number];

export type GuideSection = { heading: Localized; body: Localized };

export type Guide = {
  id: GuideId;
  href: string;
  title: Localized;
  summary: Localized;
  sections: GuideSection[];
  sourceIds: SourceId[];
};

export const guides: Guide[] = [
  {
    id: "company",
    href: "/company",
    title: { de: "Gesellschaft und Steuerprofil", en: "Company and tax profile" },
    summary: {
      de: "Firma, Steuerprofil, Bankverbindung und Beteiligungen bilden die Gesellschaft im Programm ab. Die Angaben stammen aus Handelsregister, Steuerbescheid, Fragebogen zur steuerlichen Erfassung und Versicherungsunterlagen. Das Ausfüllen hier ersetzt keine Anmeldung oder Satzungsänderung.",
      en: "Legal name, tax profile, bank details, and shareholdings represent the company in the app. The figures come from the commercial register, tax assessment, tax registration questionnaire, and insurance documents. Entering them here does not replace a registration or an amendment to the articles.",
    },
    sections: [
      {
        heading: { de: "Firma, Rechtsform und Register", en: "Legal name, legal form, and register" },
        body: {
          de: "Die Firma ist der im Handelsregister eingetragene Name, nicht ein Marketingname. Eine UG (haftungsbeschränkt) steht in Abteilung B; Sitz, Geschäftsführung und Kapitaländerungen sind registerpflichtig. Registergericht und Registernummer stehen im Handelsregisterauszug.",
          en: "The legal name is the name entered in the commercial register, not a trading name. A UG (haftungsbeschränkt) is recorded in section B; registered office, management, and capital changes must be filed. The register court and number appear in the register extract.",
        },
      },
      {
        heading: { de: "Steuernummer, USt-IdNr. und Wirtschafts-ID", en: "Tax number, VAT ID, and business ID" },
        body: {
          de: "Die Steuernummer vergibt das Finanzamt. Umsatzsteuer-Identifikationsnummer und Wirtschafts-Identifikationsnummer vergibt das Bundeszentralamt für Steuern. Für grenzüberschreitende Rechnungen ist die USt-IdNr. wichtig; ihre Gültigkeit lässt sich beim BZSt prüfen.",
          en: "The tax office assigns the tax number. The Federal Central Tax Office issues the VAT identification number and the business identification number. The VAT ID matters for cross-border invoices; its validity can be checked with the BZSt.",
        },
      },
      {
        heading: { de: "Kleinunternehmer und Umsatzsteuer", en: "Small-business rule and VAT" },
        body: {
          de: "Nach § 19 UStG kann ohne Umsatzsteuer abgerechnet werden, wenn der Umsatz im Vorjahr 25.000 € und im laufenden Jahr 100.000 € nicht übersteigt (im Gründungsjahr 25.000 €). Dann entfällt Umsatzsteuer auf Rechnungen, aber auch der Vorsteuerabzug. Sonderfälle mit der Steuerberatung klären.",
          en: "Under section 19 of the VAT Act, a business may invoice without VAT if turnover did not exceed €25,000 in the previous year and does not exceed €100,000 in the current year (€25,000 in the founding year). VAT then disappears from invoices, but so does input VAT deduction. Clarify special cases with a tax adviser.",
        },
      },
      {
        heading: { de: "Hebesatz, Vorjahresumsatz und Verlustvortrag", en: "Municipal factor, prior turnover, and loss carryforward" },
        body: {
          de: "Der Hebesatz kommt von der Gemeinde und bestimmt zusammen mit dem Messbetrag die Gewerbesteuer. Vorjahresumsatz und Verlustvortrag stammen aus Steuerbescheid oder Jahresabschluss; sie beeinflussen die Kleinunternehmerprüfung und die Steuerschätzung.",
          en: "The municipal factor is set by the municipality and, together with the assessed base, determines trade tax. Prior-year turnover and loss carryforward come from the tax assessment or annual accounts; they affect the small-business test and the tax estimate.",
        },
      },
      {
        heading: { de: "Krankenversicherung und Zusatzbeitrag", en: "Health insurance and additional contribution" },
        body: {
          de: "Der Arbeitgeberanteil folgt dem allgemeinen Beitragssatz; den Zusatzbeitrag legt die Krankenkasse fest. Der hinterlegte Satz ist der Standard für neue Beschäftigte und lässt sich pro Person überschreiben. Aktuelle Sätze stehen bei AOK, GKV-Spitzenverband und BMG.",
          en: "The employer share follows the general contribution rate; the additional contribution is set by the health insurer. The stored rate is the default for new employees and can be overridden per person. Current rates are published by AOK, the GKV-Spitzenverband, and the BMG.",
        },
      },
      {
        heading: { de: "Gesellschafter, Stammeinlage und Rücklage", en: "Shareholders, nominal capital, and reserve" },
        body: {
          de: "Gesellschafter und Stammeinlagen ergeben zusammen 100 %. Bei der UG sind 25 % des Jahresgewinns in die Rücklage zu stellen, bis das Stammkapital 25.000 € erreicht (GmbHG § 5a). Die Rücklage ist keine freie Liquidität.",
          en: "Shareholders and nominal contributions add up to 100%. A UG must set aside 25% of annual profit in a reserve until share capital reaches €25,000 (section 5a of the GmbH Act). The reserve is not free cash.",
        },
      },
      {
        heading: { de: "Bankverbindung und Zahlungsziel", en: "Bank details and payment terms" },
        body: {
          de: "IBAN und BIC stehen auf dem Kontoauszug und erscheinen auf Rechnungen. Das Zahlungsziel ist eine vertragliche Vereinbarung, kein gesetzlicher Standard; bei Verbrauchern sind die Verbraucherregeln zu beachten.",
          en: "IBAN and BIC appear on the bank statement and on invoices. Payment terms are a contractual agreement, not a statutory default; consumer rules apply to consumers.",
        },
      },
      {
        heading: { de: "Versicherungen und Kammern", en: "Insurance and chambers" },
        body: {
          de: "Berufsgenossenschaft, IHK und betriebliche Versicherungen sind Pflicht oder stark empfohlen. Anbieter, Policennummer und Beitrag stehen in den Vertragsunterlagen; Beiträge sind Betriebsausgaben.",
          en: "The trade association, the chamber of commerce, and business insurance are mandatory or strongly advised. Provider, policy number, and premium appear in the contract documents; premiums are business expenses.",
        },
      },
    ],
    sourceIds: ["handelsregister", "gesetze", "bzst", "elster", "aok", "gkv", "bmg", "ihk", "dguv", "bmas", "bmwk"],
  },
  {
    id: "customers",
    href: "/customers",
    title: { de: "Kundendaten", en: "Customer data" },
    summary: {
      de: "Kundendaten sind die Grundlage jeder Rechnung. Name und Anschrift müssen mit den Unterlagen des Kunden übereinstimmen; die USt-IdNr. entscheidet über Reverse-Charge-Fälle. Die Leitweg-ID braucht es für Rechnungen an die öffentliche Verwaltung.",
      en: "Customer data is the basis of every invoice. Name and address must match the customer's records; the VAT ID determines reverse-charge cases. A routing ID is needed for invoices to public administration.",
    },
    sections: [
      {
        heading: { de: "Name und Anschrift", en: "Name and address" },
        body: {
          de: "Rechnungen müssen den Leistungsempfänger eindeutig benennen (§ 14 UStG). Bei Firmen den vollständigen Firmennamen und die Rechnungsanschrift verwenden, nicht nur eine Abteilung oder ein Kürzel.",
          en: "Invoices must identify the recipient clearly (section 14 of the VAT Act). For companies, use the full legal name and the invoicing address, not just a department or abbreviation.",
        },
      },
      {
        heading: { de: "USt-IdNr. und Reverse Charge", en: "VAT ID and reverse charge" },
        body: {
          de: "Die USt-IdNr. des Kunden ist bei grenzüberschreitenden Leistungen und bei Reverse Charge wichtig. Die Gültigkeit beim BZSt bestätigen lassen und das Ergebnis zur Rechnung dokumentieren.",
          en: "The customer's VAT ID matters for cross-border supplies and reverse charge. Confirm its validity with the BZSt and keep the result with the invoice.",
        },
      },
      {
        heading: { de: "Leitweg-ID und Buyer Reference", en: "Routing ID and buyer reference" },
        body: {
          de: "Öffentliche Auftraggeber verlangen eine Leitweg-ID. Sie gehört als Buyer Reference in die E-Rechnung (XRechnung oder ZUGFeRD). Bei anderen Kunden kann das Feld als interne Referenz genutzt werden.",
          en: "Public-sector clients require a routing ID. It belongs in the e-invoice as the buyer reference (XRechnung or ZUGFeRD). For other customers the field can carry an internal reference.",
        },
      },
    ],
    sourceIds: ["gesetze", "bzst", "erechnung", "xoev"],
  },
  {
    id: "invoice",
    href: "/invoices/new",
    title: { de: "Rechnung schreiben", en: "Writing an invoice" },
    summary: {
      de: "Die Rechnung ist kein interner Entwurf, sondern ein Steuerdokument. Nummer, Datum, Leistung, Entgelt und Umsatzsteuer müssen zusammenpassen; bei E-Rechnungen kommen Format und Leitweg-ID dazu.",
      en: "An invoice is not an internal draft but a tax document. Number, date, service, consideration, and VAT must fit together; e-invoices add a format and a routing ID.",
    },
    sections: [
      {
        heading: { de: "Nummer und Daten", en: "Number and dates" },
        body: {
          de: "Rechnungsnummern müssen einmalig und fortlaufend sein. Das Rechnungsdatum ist der Tag der Ausstellung, das Leistungsdatum der Tag der Lieferung oder Leistung; beide können auseinanderfallen.",
          en: "Invoice numbers must be unique and sequential. The issue date is the day the invoice is issued; the service date is the day of supply or service. They can differ.",
        },
      },
      {
        heading: { de: "Leistung, Menge und Preis", en: "Service, quantity, and price" },
        body: {
          de: "Jede Position braucht eine klare Beschreibung, Menge, Einzelpreis und Gesamtbetrag. Pauschalformulierungen ohne Leistungsbezug sind bei einer Prüfung angreifbar.",
          en: "Each line needs a clear description, quantity, unit price, and total. Flat-rate wording without a service reference is vulnerable in an audit.",
        },
      },
      {
        heading: { de: "Umsatzsteuer", en: "VAT" },
        body: {
          de: "19 % ist der Regelsatz, 7 % gilt nur für gesetzlich benannte Leistungen. 0 % ist keine Ermäßigung, sondern eine Steuerbefreiung mit eigener Begründung. Kleinunternehmer nach § 19 UStG weisen keine Umsatzsteuer aus.",
          en: "19% is the standard rate; 7% applies only to supplies named in the law. 0% is not a reduced rate but an exemption with its own justification. Small businesses under section 19 of the VAT Act do not show VAT.",
        },
      },
      {
        heading: { de: "Fälligkeit und Zahlungsziel", en: "Due date and payment terms" },
        body: {
          de: "Das Zahlungsziel ist frei vereinbar. Ohne Vereinbarung greifen die gesetzlichen Regelungen; Verzug und Verzugszinsen richten sich nach dem BGB. Ein zu kurzes Ziel sollte mit dem Kunden abgestimmt sein.",
          en: "Payment terms are freely negotiable. Without an agreement, statutory rules apply; default and default interest follow the Civil Code. A very short term should be agreed with the customer.",
        },
      },
      {
        heading: { de: "E-Rechnung", en: "E-invoicing" },
        body: {
          de: "Seit 1. Januar 2025 müssen Unternehmen in Deutschland E-Rechnungen im B2B-Verkehr empfangen können. Die Pflicht, E-Rechnungen auszustellen, startet 2027 für größere und 2028 für alle Unternehmen. XRechnung und ZUGFeRD folgen der europäischen Norm EN 16931.",
          en: "Since 1 January 2025, businesses in Germany must be able to receive e-invoices in B2B trade. The obligation to issue e-invoices starts in 2027 for larger businesses and in 2028 for all. XRechnung and ZUGFeRD follow European standard EN 16931.",
        },
      },
    ],
    sourceIds: ["gesetze", "bmf", "erechnung", "xoev", "bundesregierung"],
  },
  {
    id: "time",
    href: "/time",
    title: { de: "Zeiterfassung", en: "Time tracking" },
    summary: {
      de: "Zeiterfassung ist Arbeitszeit und zugleich Abrechnungsgrundlage. Pausen, Ruhezeiten und Höchstarbeitszeit folgen dem Arbeitszeitgesetz; Vergütung und Sozialversicherung hängen von der Beschäftigungsart ab.",
      en: "Time records are working time and a billing basis. Breaks, rest periods, and maximum hours follow the Working Hours Act; pay and social insurance depend on the type of employment.",
    },
    sections: [
      {
        heading: { de: "Arbeitszeit und Pausen", en: "Working time and breaks" },
        body: {
          de: "Höchstens 8 Stunden werktäglich, ausnahmsweise 10 Stunden, wenn der Durchschnitt ausgeglichen wird (§ 3 ArbZG). Nach mehr als 6 Stunden sind 30 Minuten Pause fällig, nach mehr als 9 Stunden 60 Minuten (§ 4 ArbZG); zwischen zwei Arbeitstagen liegen mindestens 11 Stunden.",
          en: "At most 8 hours per working day, exceptionally 10 hours if the average is balanced (section 3 of the Working Hours Act). More than 6 hours require a 30-minute break; more than 9 hours require 60 minutes (section 4). At least 11 hours must lie between two working days.",
        },
      },
      {
        heading: { de: "Erfassung und Nachvollziehbarkeit", en: "Recording and traceability" },
        body: {
          de: "Die geleistete Arbeitszeit ist zu dokumentieren. Beginn, Ende, Pausen und Projektbezug sollten so erfasst werden, dass Dritte die Abrechnung nachvollziehen können; nachträgliche Änderungen sind zu kennzeichnen.",
          en: "Working time must be documented. Start, end, breaks, and project reference should let a third party follow the billing; later changes should be marked.",
        },
      },
      {
        heading: { de: "Minijob und Midijob", en: "Mini-job and midi-job" },
        body: {
          de: "Ein Minijob liegt 2026 bis 603 € monatlich vor, der Übergangsbereich reicht bis 2.000 €. Im Minijob zahlt der Arbeitgeber pauschale Beiträge; im Übergangsbereich gelten besondere Beitragsformeln. Maßgeblich sind die Rechengrößen des GKV-Spitzenverbands.",
          en: "In 2026 a mini-job covers up to €603 per month; the transition range extends to €2,000. In a mini-job the employer pays flat-rate contributions; the transition range uses special formulas. The GKV-Spitzenverband publishes the governing figures.",
        },
      },
      {
        heading: { de: "Datenschutz", en: "Data protection" },
        body: {
          de: "Zeitdaten sind personenbezogene Daten. Zugriff auf Buchhaltung und Geschäftsführung begrenzen und Löschfristen festlegen.",
          en: "Time data is personal data. Limit access to accounting and management and define deletion periods.",
        },
      },
    ],
    sourceIds: ["gesetze", "bmas", "mindestlohn", "drv", "aok", "gkv", "bfdi"],
  },
  {
    id: "obligations",
    href: "/obligations",
    title: { de: "Fristen und Pflichten", en: "Deadlines and obligations" },
    summary: {
      de: "Fristen entstehen aus Steuerrecht, Sozialversicherung und Gesellschaftsrecht. Das Programm rechnet Standardfristen; Sonderfristen, Feiertage und steuerliche Beratung können abweichen.",
      en: "Deadlines arise from tax law, social insurance, and company law. The app calculates standard deadlines; special rules, public holidays, and tax advice can differ.",
    },
    sections: [
      {
        heading: { de: "Umsatzsteuer", en: "VAT" },
        body: {
          de: "Umsatzsteuer-Voranmeldungen sind monatlich oder vierteljährlich abzugeben; die Dauerfristverlängerung verschiebt die Frist um einen Monat. Die Abgabe erfolgt über ELSTER oder die Steuerberatung.",
          en: "VAT advance returns are filed monthly or quarterly; an extension shifts the deadline by one month. Filing runs through ELSTER or a tax adviser.",
        },
      },
      {
        heading: { de: "Lohn und Sozialversicherung", en: "Payroll and social insurance" },
        body: {
          de: "Lohnsteuer und Sozialversicherungsbeiträge sind für jeden Abrechnungsmonat fällig. Arbeitgeber melden Beschäftigte und zahlen Beiträge an die Krankenkasse; die Rentenversicherung führt das Versicherungskonto.",
          en: "Wage tax and social insurance contributions are due for every payroll month. Employers register employees and pay contributions to the health insurer; the pension insurer maintains the insurance account.",
        },
      },
      {
        heading: { de: "Jahresabschluss und Offenlegung", en: "Annual accounts and disclosure" },
        body: {
          de: "Der Jahresabschluss ist aufzustellen und je nach Rechtsform offenzulegen. Offenlegungen laufen über Bundesanzeiger und Unternehmensregister; Fristen hängen von Größe und Rechtsform ab.",
          en: "Annual accounts must be prepared and, depending on the legal form, disclosed. Disclosures run through the Federal Gazette and the Company Register; deadlines depend on size and legal form.",
        },
      },
      {
        heading: { de: "Eigene Fristen", en: "Your own deadlines" },
        body: {
          de: "Vertragsfristen, Versicherungen und interne Termine gehören nicht zu den gesetzlichen Standardfristen. Sie werden hier manuell gepflegt und sollten mit einer Vertretung abgestimmt sein.",
          en: "Contract deadlines, insurance, and internal dates are not statutory standard deadlines. They are maintained manually here and should be agreed with a deputy.",
        },
      },
    ],
    sourceIds: ["elster", "bmf", "gesetze", "bundesanzeiger", "unternehmensregister", "drv", "aok", "gkv"],
  },
  {
    id: "ledger",
    href: "/ledger",
    title: { de: "Buchführung", en: "Bookkeeping" },
    summary: {
      de: "Die Buchführung verbindet Belege, Konten und Umsatzsteuer. Jede Buchung braucht Datum, Betrag, Konto und Beleg; die Umsatzsteuer wird daraus abgeleitet.",
      en: "Bookkeeping connects receipts, accounts, and VAT. Every entry needs a date, amount, account, and receipt; VAT is derived from them.",
    },
    sections: [
      {
        heading: { de: "Buchführungspflicht", en: "Duty to keep books" },
        body: {
          de: "Kaufleute und Gesellschaften müssen Bücher führen (§ 238 HGB); für die Steuer gilt § 4 EStG. Die GoBD regeln, wie Buchungen und Belege digital aufbewahrt werden.",
          en: "Merchants and companies must keep books (section 238 of the Commercial Code); section 4 of the Income Tax Act applies for tax purposes. The GoBD rules govern digital record keeping.",
        },
      },
      {
        heading: { de: "Konten und Buchungen", en: "Accounts and entries" },
        body: {
          de: "Soll und Haben müssen in Summe übereinstimmen. Private Ausgaben gehören nicht in die Betriebsbuchhaltung; Entnahmen und Einlagen werden getrennt gebucht.",
          en: "Debits and credits must balance. Private expenses do not belong in business bookkeeping; withdrawals and contributions are posted separately.",
        },
      },
      {
        heading: { de: "Ausgaben und Vorsteuer", en: "Expenses and input VAT" },
        body: {
          de: "Vorsteuer lässt sich nur aus einer ordnungsgemäßen Rechnung mit ausgewiesener Umsatzsteuer abziehen. Kleinunternehmer nach § 19 UStG ziehen keine Vorsteuer ab; bei 0 % gibt es ebenfalls keinen Abzug.",
          en: "Input VAT can only be deducted from a proper invoice showing VAT. Small businesses under section 19 of the VAT Act cannot deduct input VAT; 0% also gives no deduction.",
        },
      },
      {
        heading: { de: "Umsatzsteuer-Vorauszahlung", en: "VAT advance payment" },
        body: {
          de: "Gezahlte oder erhaltene Umsatzsteuer wird mit der Vorsteuer verrechnet. Der Saldo wird als Vorauszahlung an das Finanzamt gemeldet und über ELSTER übermittelt.",
          en: "VAT paid or received is offset against input VAT. The balance is reported as an advance payment to the tax office and transmitted via ELSTER.",
        },
      },
    ],
    sourceIds: ["gesetze", "bmf", "elster", "ihk"],
  },
  {
    id: "person",
    href: "/people/new",
    title: { de: "Person und Lohn", en: "Person and payroll" },
    summary: {
      de: "Personendaten steuern Lohnabrechnung, Sozialversicherung und Urlaub. Steuerklasse, Krankenkasse und Beschäftigungsart müssen zu den Nachweisen passen; Änderungen wirken ab dem vereinbarten Zeitpunkt.",
      en: "Personal data drives payroll, social insurance, and vacation. Tax class, health insurer, and employment type must match the records; changes apply from the agreed date.",
    },
    sections: [
      {
        heading: { de: "Beschäftigungsart", en: "Type of employment" },
        body: {
          de: "Regulär, Minijob, Midijob, Ausbildung oder Geschäftsführung bestimmen die Beitrags- und Lohnlogik. Ein Minijob liegt 2026 bis 603 € monatlich vor, der Übergangsbereich reicht bis 2.000 €. Geschäftsführer sind je nach Beteiligung und Vertrag gesondert zu beurteilen.",
          en: "Regular employment, mini-job, midi-job, apprenticeship, or managing director determines contributions and payroll logic. In 2026 a mini-job covers up to €603 per month; the transition range extends to €2,000. Managing directors are assessed separately depending on shareholding and contract.",
        },
      },
      {
        heading: { de: "Steuerklasse und Steuer-ID", en: "Tax class and tax ID" },
        body: {
          de: "Die Steuerklasse ist beim Finanzamt hinterlegt; die Steuer-ID ist die elfstellige Identifikationsnummer. Beides beeinflusst die Lohnsteuer, nicht die Sozialversicherung.",
          en: "The tax class is held by the tax office; the tax ID is the eleven-digit identification number. Both affect wage tax, not social insurance.",
        },
      },
      {
        heading: { de: "Sozialversicherung", en: "Social insurance" },
        body: {
          de: "Die Sozialversicherungsnummer kommt von der Deutschen Rentenversicherung. Die Krankenkasse meldet den Zusatzbeitrag; Kinder und Pflegegrad beeinflussen den Pflegeversicherungsbeitrag, Kinderlose zahlen einen Zuschlag.",
          en: "The social insurance number comes from the German Pension Insurance. The health insurer reports the additional contribution; children and care levels affect long-term care contributions, and childless employees pay a surcharge.",
        },
      },
      {
        heading: { de: "Lohn und Lohnsteuer", en: "Pay and wage tax" },
        body: {
          de: "Das Bruttogehalt ist die vereinbarte Vergütung vor Abzügen. Die Lohnsteuer wird nach Steuerklasse und Freibeträgen einbehalten; der Arbeitgeber meldet sie über ELSTER an.",
          en: "Gross pay is the agreed remuneration before deductions. Wage tax is withheld according to tax class and allowances; the employer reports it via ELSTER.",
        },
      },
      {
        heading: { de: "Urlaub und Abwesenheit", en: "Vacation and absence" },
        body: {
          de: "Das Bundesurlaubsgesetz sichert mindestens 24 Werktage bei einer Sechs-Tage-Woche, also 20 Arbeitstage bei fünf Arbeitstagen. Krankheit und Urlaub werden getrennt erfasst; Entgeltfortzahlung folgt dem Entgeltfortzahlungsgesetz.",
          en: "The Federal Vacation Act guarantees at least 24 working days in a six-day week, which is 20 working days in a five-day week. Sickness and vacation are recorded separately; continued pay follows the Continued Remuneration Act.",
        },
      },
    ],
    sourceIds: ["bmas", "aok", "gkv", "drv", "arbeitsagentur", "bmf", "gesetze", "elster", "sozialversicherung"],
  },
  {
    id: "documents",
    href: "/documents",
    title: { de: "Dokumente und Aufbewahrung", en: "Documents and retention" },
    summary: {
      de: "Dokumente sind Belege und Nachweise. Kategorie und Aufbewahrung entscheiden, wie schnell sie bei Prüfung, Bank oder Versicherung auffindbar sind.",
      en: "Documents are receipts and evidence. Category and retention determine how quickly they can be found for an audit, bank, or insurer.",
    },
    sections: [
      {
        heading: { de: "Kategorien", en: "Categories" },
        body: {
          de: "Gesellschaft, Steuern, Rechnungen, Beschäftigung, Versicherung und Sonstiges trennen unterschiedliche Nachweispflichten. Die Kategorie erleichtert die Suche, nicht die rechtliche Bewertung.",
          en: "Company, tax, invoices, employment, insurance, and other separate different evidentiary duties. The category helps searching, not legal assessment.",
        },
      },
      {
        heading: { de: "Aufbewahrung", en: "Retention" },
        body: {
          de: "Buchungsbelege, Verträge und Lohnunterlagen unterliegen gesetzlichen Aufbewahrungsfristen (§ 147 AO, § 257 HGB). Nach Ablauf der Frist werden sie datenschutzgerecht gelöscht; die konkrete Frist hängt von der Unterlage ab.",
          en: "Accounting records, contracts, and payroll documents are subject to statutory retention periods (section 147 of the Fiscal Code, section 257 of the Commercial Code). After the period they are deleted in line with data protection; the exact period depends on the document.",
        },
      },
      {
        heading: { de: "Datenschutz", en: "Data protection" },
        body: {
          de: "Beschäftigtendaten und Kundendaten sind personenbezogen. Zugriff beschränken, Verschlüsselung prüfen und keine Kopien außerhalb des vorgesehenen Speicherorts ablegen.",
          en: "Employee and customer data are personal. Limit access, check encryption, and keep no copies outside the intended storage location.",
        },
      },
    ],
    sourceIds: ["gesetze", "bmf", "bfdi", "ihk"],
  },
  {
    id: "legal",
    href: "/legal",
    title: { de: "Rechtliche Pflichten", en: "Legal obligations" },
    summary: {
      de: "Rechtliche Pflichten treffen die Gesellschaft, nicht nur die Geschäftsführung. Beschlüsse, Registermeldungen und Insolvenzantragspflichten sollten dokumentiert und termingerecht erledigt werden.",
      en: "Legal duties bind the company, not only its management. Resolutions, register filings, and insolvency filing duties should be documented and completed on time.",
    },
    sections: [
      {
        heading: { de: "Gesellschaftsrecht", en: "Company law" },
        body: {
          de: "Satzung, Gesellschafterbeschlüsse und Registereintragungen bilden die Grundlage. Änderungen von Firma, Sitz, Geschäftsführung oder Kapital sind zum Handelsregister anzumelden; viele Änderungen brauchen notarielle Beurkundung.",
          en: "Articles, shareholder resolutions, and register entries form the basis. Changes to name, seat, management, or capital must be filed with the commercial register; many changes require notarisation.",
        },
      },
      {
        heading: { de: "Insolvenz", en: "Insolvency" },
        body: {
          de: "Bei Zahlungsunfähigkeit oder Überschuldung besteht eine Antragspflicht. § 15a InsO nennt in der Regel drei Wochen für Zahlungsunfähigkeit und sechs Wochen für Überschuldung; die Fristen sind keine Freigabe zum Weiterwirtschaften.",
          en: "Insolvency or over-indebtedness triggers a filing duty. Section 15a of the Insolvency Code generally allows three weeks for insolvency and six weeks for over-indebtedness; the periods are not permission to keep trading.",
        },
      },
      {
        heading: { de: "Arbeitsrecht und Sozialversicherung", en: "Labour law and social insurance" },
        body: {
          de: "Arbeitsverträge, Lohnabrechnung und Sozialversicherungsmeldungen sind Pflichten des Arbeitgebers. Verstöße können Bußgelder und Nachzahlungen auslösen.",
          en: "Employment contracts, payroll, and social insurance notifications are employer duties. Violations can trigger fines and back payments.",
        },
      },
      {
        heading: { de: "Kammern und Aufsicht", en: "Chambers and supervision" },
        body: {
          de: "IHK, Berufsgenossenschaft und Finanzamt haben unterschiedliche Zuständigkeiten. Mitgliedschaft und Beiträge ergeben sich aus Rechtsform, Branche und Ort.",
          en: "The chamber of commerce, trade association, and tax office have different responsibilities. Membership and contributions depend on legal form, sector, and location.",
        },
      },
    ],
    sourceIds: ["gesetze", "handelsregister", "ihk", "bmas", "bundesanzeiger", "dguv"],
  },
  {
    id: "projects",
    href: "/projects",
    title: { de: "Projekte und Leistungsnachweis", en: "Projects and proof of work" },
    summary: {
      de: "Projekte bündeln Kunden, Aufgaben und Zeit. Sie sind keine gesetzlich vorgeschriebene Kategorie, sondern die interne Grundlage für Leistungsnachweis, Abrechnung und Auswertung.",
      en: "Projects bundle customers, tasks, and time. They are not a statutory category but the internal basis for proof of work, billing, and analysis.",
    },
    sections: [
      {
        heading: { de: "Projekt und Kunde", en: "Project and customer" },
        body: {
          de: "Ein Projekt sollte einen Auftraggeber, einen Zeitraum und einen abrechenbaren Rahmen haben. Ohne schriftliche Vereinbarung droht Streit über Umfang und Vergütung.",
          en: "A project should have a client, a period, and a billable scope. Without a written agreement, disputes about scope and remuneration are likely.",
        },
      },
      {
        heading: { de: "Zeit und Leistungsnachweis", en: "Time and proof of work" },
        body: {
          de: "Projektzeiten und erledigte Aufgaben belegen die Leistung. Wenn daraus eine Rechnung wird, müssen Leistungsbeschreibung und Betrag zur Rechnung passen.",
          en: "Project time and completed tasks evidence the work. If they lead to an invoice, the description and amount must match the invoice.",
        },
      },
      {
        heading: { de: "Datenschutz", en: "Data protection" },
        body: {
          de: "Kundendaten und Projektdaten können personenbezogen sein. Zugriff und Aufbewahrung sollten dem Auftrag und der DSGVO entsprechen.",
          en: "Customer and project data can be personal. Access and retention should follow the engagement and the GDPR.",
        },
      },
    ],
    sourceIds: ["ihk", "erechnung", "bfdi", "gesetze"],
  },
];

export const guideById = new Map<GuideId, Guide>(guides.map((guide) => [guide.id, guide]));

export function guideSources(guide: Guide): Source[] {
  return guide.sourceIds.flatMap((id) => {
    const source = sourceById.get(id);
    return source ? [source] : [];
  });
}

export function guidesUsingSource(id: SourceId): Guide[] {
  return guides.filter((guide) => guide.sourceIds.includes(id));
}

export type DomainGroup = { domain: string; sources: Source[] };

/** Every source sorted by its parent domain, then by title. */
export function sourceGroups(current: Locale): DomainGroup[] {
  const groups = new Map<string, Source[]>();
  for (const source of sources) {
    const list = groups.get(source.domain);
    if (list) list.push(source);
    else groups.set(source.domain, [source]);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, entries]) => ({
      domain,
      sources: [...entries].sort((left, right) => pick(left.title, current).localeCompare(pick(right.title, current))),
    }));
}
