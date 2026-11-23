import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import { translate } from "@docusaurus/Translate";
import useBaseUrl from "@docusaurus/useBaseUrl";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

function t(id: string, message: string): string {
  return translate({ id, message });
}

const areas: { id: string; term: string; text: string }[] = [
  {
    id: "home.area.company",
    term: "Gesellschaft",
    text: "Legal name, shareholders, Stammkapital, the reserve under §5a GmbHG, and shareholder loans with drawdown, repayment, and interest.",
  },
  {
    id: "home.area.founder",
    term: "Vergütung",
    text: "A written managing-director contract with a fixed salary, salary changes checked against a prior shareholder resolution, founder health cover, and the Statusfeststellungsverfahren. The desk records the paperwork; it does not decide appropriateness or social-insurance status.",
  },
  {
    id: "home.area.deadlines",
    term: "Fristen",
    text: "VAT, wage tax, trade tax, corporate tax, social insurance, disclosure, IHK, the Berufsgenossenschaft, and custom deadlines on one calendar.",
  },
  {
    id: "home.area.invoices",
    term: "Rechnungen",
    text: "Draft, issue, pay, and void. The printout carries the particulars of §14 UStG and §35a GmbHG. An issued invoice downloads as XRechnung 3.0.2. The file is not sent.",
  },
  {
    id: "home.area.books",
    term: "Bücher",
    text: "A SKR03 working chart, a trial balance, profit before tax, and a corporate-tax estimate. Journals balance, and a correction is a reversing entry.",
  },
  {
    id: "home.area.people",
    term: "Personen",
    text: "Employment, 2026 minijob, midijob, and regular contribution estimates, vacation, salary history, founder health cover, a payroll journal, and an org chart built from the reporting lines on each person. Wage tax is entered, not calculated.",
  },
  {
    id: "home.area.bank",
    term: "Bank",
    text: "A read-only Qonto connection per company stores business accounts and transactions, with balances, counterparties, categories, and a year of history. Nothing is posted to the journal, and the key never leaves this computer.",
  },
  {
    id: "home.area.cashflow",
    term: "Geldfluss",
    text: "One year from invoicing to the tax office: gross revenue split into purchases, net wages, wage tax, social insurance, VAT, corporate tax, solidarity surcharge, trade tax, and profit, with the VAT chain and the actual bank movements behind it.",
  },
  {
    id: "home.area.milestones",
    term: "Ziele",
    text: "Projects, time, deliverables, and a yearly analysis of productive work. Overarching milestones compare goals across companies by status, category, company, and quarter; a customer report prints from the same figures.",
  },
  {
    id: "home.area.records",
    term: "Akte",
    text: "Time records, documents on disk, a legal checklist, and shareholder resolutions.",
  },
  {
    id: "home.area.sources",
    term: "Quellen",
    text: "Every explanation sits beside the official websites behind it. The source register groups them by domain, and the assistant names the same link.",
  },
  {
    id: "home.area.assistant",
    term: "Assistent",
    text: "A chat panel that reads and posts with the same tools as the screens, including the bank view, money flow, milestones, org chart, and source register. It shows each step as it happens and puts the created record in front of you as a card. Plus an MCP endpoint for other agents. With a local model the conversation stays on this computer. A cloud endpoint receives it.",
  },
];

export default function Home(): ReactNode {
  const deskShot = useBaseUrl("/img/screens/desk.png");
  const phoneDashboard = useBaseUrl("/img/ios/iphone-dashboard.png");
  const phoneInvoice = useBaseUrl("/img/ios/iphone-invoice.png");
  const phoneTime = useBaseUrl("/img/ios/iphone-time.png");

  return (
    <Layout
      title={t("home.meta.title", "A local desk for German companies")}
      description={t(
        "home.meta.description",
        "managr is a local planning desk for German companies, including the UG (haftungsbeschränkt), an Einzelunternehmen, and other legal forms: company records, obligations, invoices, a ledger, people, legal notes, and a native iPhone app.",
      )}
    >
      <div className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div>
              <p className={styles.kicker}>UG · Einzelunternehmen · GmbH</p>
              <h1 id="hero-title">{t("home.hero.title", "A local desk for your companies.")}</h1>
              <p className={styles.lead}>
                {t(
                  "home.hero.lead",
                  "managr keeps Stammdaten, the statutory reserve, obligations, invoices, a double-entry ledger, the bank view, people, time, documents, and legal notes for each company. Every company has separate books. It runs on this computer and on the iPhone over your Wi-Fi.",
                )}
              </p>
              <div className={styles.actions}>
                <Link className={styles.primary} to="/docs">
                  {t("home.hero.readDocs", "Read the docs")}
                </Link>
                <Link className={styles.secondary} to="/docs/iphone">
                  {t("home.hero.iphone", "iPhone app")}
                </Link>
                <Link className={styles.secondary} href="https://github.com/403access/managr">
                  {t("home.hero.source", "View the source")}
                </Link>
              </div>
              <p className={styles.disclaimer}>
                {t(
                  "home.hero.disclaimer",
                  "A planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.",
                )}
              </p>
            </div>
            <aside
              className={styles.extract}
              aria-label={t("home.sample.aria", "Sample company loaded on first launch")}
            >
              <p className={styles.extractLabel}>{t("home.sample.label", "Sample · first launch")}</p>
              <h2 lang="de">Atelier Nordlicht UG (haftungsbeschränkt)</h2>
              <dl className={styles.facts}>
                <div>
                  <dt>Sitz</dt>
                  <dd>Berlin</dd>
                </div>
                <div>
                  <dt>Stammkapital</dt>
                  <dd>2.500,00 €</dd>
                </div>
                <div>
                  <dt>Geschäftsführung</dt>
                  <dd>Mara Elling</dd>
                </div>
                <div>
                  <dt>Registergericht</dt>
                  <dd>Amtsgericht Berlin-Charlottenburg</dd>
                </div>
                <div>
                  <dt>HRB</dt>
                  <dd>123456 B</dd>
                </div>
              </dl>
              <p className={styles.extractFoot}>
                {t(
                  "home.sample.foot.before",
                  "Obviously fake. HRB 123456 B is not a register entry. Delete",
                )}{" "}
                <code>data/managr.db</code>
                {t("home.sample.foot.after", " to restore this company.")}
              </p>
            </aside>
          </section>

          <section className={styles.shot} aria-labelledby="shot-title">
            <div className={styles.sectionHead}>
              <h2 id="shot-title">{t("home.shot.title", "The desk, at a glance.")}</h2>
              <p>
                {t(
                  "home.shot.intro",
                  "The sample company on first launch: the figures, the invoices, the next deadlines, and the week's time.",
                )}
              </p>
            </div>
            <figure className={styles.deskShot}>
              <img
                src={deskShot}
                alt={t("home.shot.alt", "The managr overview with the sample company")}
                loading="lazy"
              />
              <figcaption>
                {t(
                  "home.shot.caption",
                  "One screen for the figures, open invoices, and the deadlines that need attention.",
                )}
              </figcaption>
            </figure>
          </section>

          <section className={styles.holds} aria-labelledby="holds-title">
            <div className={styles.sectionHead}>
              <h2 id="holds-title">{t("home.holds.title", "What the desk holds")}</h2>
              <p>
                {t(
                  "home.holds.intro",
                  "Version 1 is the desk in this repository. The roadmap lists what a later version might add, and what this one refuses to imitate.",
                )}
              </p>
            </div>
            <ul className={styles.areas}>
              {areas.map((area) => (
                <li key={area.id} className={styles.area}>
                  <h3 lang="de">{area.term}</h3>
                  <p>{t(area.id, area.text)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.pocket} aria-labelledby="pocket-title">
            <div className={styles.sectionHead}>
              <h2 id="pocket-title">{t("home.pocket.title", "The same desk, in your pocket.")}</h2>
              <p>
                {t(
                  "home.pocket.intro",
                  "The native iPhone app reads and writes the same local desk over your Wi-Fi. No cloud, no second database, no sign-in. Issue an invoice, record a payment, or book time from the phone; the Mac still holds the books.",
                )}
              </p>
            </div>
            <div className={styles.phones}>
              <figure>
                <img
                  src={phoneDashboard}
                  alt={t("home.pocket.alt.overview", "The managr overview on the iPhone")}
                  loading="lazy"
                />
                <figcaption>{t("home.pocket.overview", "Overview")}</figcaption>
              </figure>
              <figure>
                <img
                  src={phoneInvoice}
                  alt={t("home.pocket.alt.invoice", "An invoice with a payment action on the iPhone")}
                  loading="lazy"
                />
                <figcaption>{t("home.pocket.invoice", "Invoice")}</figcaption>
              </figure>
              <figure>
                <img
                  src={phoneTime}
                  alt={t("home.pocket.alt.time", "The time screen on the iPhone")}
                  loading="lazy"
                />
                <figcaption>{t("home.pocket.time", "Time")}</figcaption>
              </figure>
            </div>
            <p className={styles.pocketLink}>
              <Link to="/docs/iphone">{t("home.pocket.link", "Build and install the iPhone app")} →</Link>
            </p>
          </section>

          <section
            className={styles.split}
            aria-label={t("home.split.aria", "How it runs, and what it refuses")}
          >
            <div className={styles.runs}>
              <h2>{t("home.runs.title", "On this computer")}</h2>
              <ul>
                <li>{t("home.runs.oneUser", "One user, several companies, no sign-in.")}</li>
                <li>
                  {t("home.runs.sqlite.before", "SQLite in")} <code>data/managr.db</code>
                  {t("home.runs.sqlite.middle", ". Files in")} <code>data/uploads</code>
                  {t("home.runs.sqlite.after", ".")}
                </li>
                <li>
                  {t(
                    "home.runs.language",
                    "German by default, English second. Dates, amounts, and a printed invoice stay German.",
                  )}
                </li>
                <li>{t("home.runs.browser", "The browser never opens the database.")}</li>
                <li>
                  {t(
                    "home.runs.bank",
                    "The Qonto connection is read-only. The key stays in the local database and is never shown in full.",
                  )}
                </li>
                <li>
                  {t(
                    "home.runs.assistant",
                    "The assistant uses the same tools as the screens. Point it at a local model to keep the conversation here.",
                  )}
                </li>
              </ul>
              <pre className={styles.command}>
                <code>bun install{"\n"}bun run dev</code>
              </pre>
              <p className={styles.caption}>
                {t("home.runs.caption.before", "Then open")} <code>http://localhost:3000</code>
                {t("home.runs.caption.after", ".")}
              </p>
            </div>
            <div className={styles.refuses}>
              <h2>{t("home.refuses.title", "It will not pretend")}</h2>
              <ul>
                <li>{t("home.refuses.elster", "No ELSTER transmission.")}</li>
                <li>
                  {t(
                    "home.refuses.wageTax",
                    "No Lohnsteuer calculation. Wage tax is a number you enter.",
                  )}
                </li>
                <li>
                  {t(
                    "home.refuses.datev",
                    "No DATEV export and no bank CSV import. The Qonto connection is read-only.",
                  )}
                </li>
                <li>
                  {t(
                    "home.refuses.xrechnung",
                    "The XRechnung file is a download. It is not sent.",
                  )}
                </li>
                <li>
                  {t(
                    "home.refuses.contributions",
                    "Contribution figures are estimates. They are not a Statusfeststellung.",
                  )}
                </li>
                <li>
                  {t(
                    "home.refuses.assistant",
                    "The assistant does not send, file, or decide. It calls the same tools as the screens.",
                  )}
                </li>
              </ul>
              <p className={styles.refuseLinks}>
                <Link to="/docs/domain">{t("home.refuses.domain", "Domain rules")}</Link>
                <Link to="/docs/roadmap">{t("home.refuses.roadmap", "Roadmap")}</Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
