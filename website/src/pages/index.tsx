import type { ReactNode } from "react";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import styles from "./index.module.css";

const areas: { term: string; text: string }[] = [
  {
    term: "Gesellschaft",
    text: "Legal name, shareholders, Stammkapital, and the reserve under §5a GmbHG, including the gap toward €25,000 share capital.",
  },
  {
    term: "Fristen",
    text: "VAT, wage tax, trade tax, corporate tax, social insurance, disclosure, IHK, the Berufsgenossenschaft, and custom deadlines on one calendar.",
  },
  {
    term: "Rechnungen",
    text: "Draft, issue, pay, and void. The printout carries the particulars of §14 UStG and §35a GmbHG. An issued invoice downloads as XRechnung 3.0.2. The file is not sent.",
  },
  {
    term: "Bücher",
    text: "A SKR03 working chart, a trial balance, profit before tax, and a corporate-tax estimate. Journals balance, and a correction is a reversing entry.",
  },
  {
    term: "Personen",
    text: "Employment, 2026 minijob, midijob, and regular contribution estimates, vacation, founder health cover, and a payroll journal. Wage tax is entered, not calculated.",
  },
  {
    term: "Akte",
    text: "Time records, documents on disk, a legal checklist, and shareholder resolutions.",
  },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="A local desk for one German UG"
      description="managr is a local planning desk for one Unternehmergesellschaft (haftungsbeschränkt): company records, obligations, invoices, a ledger, people, and legal notes."
    >
      <div className={styles.page}>
        <div className={styles.wrap}>
          <section className={styles.hero} aria-labelledby="hero-title">
            <div>
              <p className={styles.kicker}>UG (haftungsbeschränkt)</p>
              <h1 id="hero-title">A local desk for one company.</h1>
              <p className={styles.lead}>
                managr keeps Stammdaten, the statutory reserve, obligations, invoices, a double-entry ledger, people, time,
                documents, and legal notes for one Unternehmergesellschaft. It runs on this computer.
              </p>
              <div className={styles.actions}>
                <Link className={styles.primary} to="/docs">
                  Read the docs
                </Link>
                <Link className={styles.secondary} href="https://github.com/403access/managr">
                  View the source
                </Link>
              </div>
              <p className={styles.disclaimer}>
                A planning aid. It does not file a return, calculate wage tax, or decide social-insurance status.
              </p>
            </div>
            <aside className={styles.extract} aria-label="Sample company loaded on first launch">
              <p className={styles.extractLabel}>Sample · first launch</p>
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
                Obviously fake. HRB 123456 B is not a register entry. Delete <code>data/managr.db</code> to restore this company.
              </p>
            </aside>
          </section>

          <section className={styles.holds} aria-labelledby="holds-title">
            <div className={styles.sectionHead}>
              <h2 id="holds-title">What the desk holds</h2>
              <p>Version 1 is the desk in this repository. The roadmap lists what a later version might add, and what this one refuses to imitate.</p>
            </div>
            <ul className={styles.areas}>
              {areas.map((area) => (
                <li key={area.term} className={styles.area}>
                  <h3 lang="de">{area.term}</h3>
                  <p>{area.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.split} aria-label="How it runs, and what it refuses">
            <div className={styles.runs}>
              <h2>On this computer</h2>
              <ul>
                <li>One user, one company, no sign-in.</li>
                <li>
                  SQLite in <code>data/managr.db</code>. Files in <code>data/uploads</code>.
                </li>
                <li>German by default, English second. Dates, amounts, and a printed invoice stay German.</li>
                <li>The browser never opens the database.</li>
              </ul>
              <pre className={styles.command}>
                <code>bun install{"\n"}bun run dev</code>
              </pre>
              <p className={styles.caption}>
                Then open <code>http://localhost:3000</code>.
              </p>
            </div>
            <div className={styles.refuses}>
              <h2>It will not pretend</h2>
              <ul>
                <li>No ELSTER transmission.</li>
                <li>No Lohnsteuer calculation. Wage tax is a number you enter.</li>
                <li>No DATEV export and no bank feed.</li>
                <li>The XRechnung file is a download. It is not sent.</li>
                <li>Contribution figures are estimates. They are not a Statusfeststellung.</li>
              </ul>
              <p className={styles.refuseLinks}>
                <Link to="/docs/domain">Domain rules</Link>
                <Link to="/docs/roadmap">Roadmap</Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
}
