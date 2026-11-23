---
slug: /domain
---

# Domänenregeln

managr ist eine Planungshilfe. Es reicht nichts ein, beurteilt den Sozialversicherungsstatus nicht und berechnet keine Lohnsteuer. Die Oberfläche muss das überall sichtbar halten, wo sie eine Schätzung zeigt.

Wenn ein Satz hier dem Code widerspricht, gewinnt das unten genannte TypeScript-Modul, und diese Datei wird in derselben Änderung aktualisiert. Zahlen stehen nur in `src/domain/rates-2026.ts`. Kontonummern stehen nur in `src/domain/accounts.ts`.

## Gesellschaftsrecht

Eine Unternehmergesellschaft (haftungsbeschränkt) verwendet diese Bezeichnung oder die Kurzform UG (haftungsbeschränkt) in ihrem Namen. Die Rechnungsprüfung lehnt einen UG-Namen ab, der keines von beiden enthält. Andere Rechtsformen werden als Code gespeichert (`ug`, `gmbh`, `ag`, `kg`, `ohg`, `gbr`, `einzelunternehmen`, `ek`, `partg`); die Namensprüfung folgt der Rechtsform. Jedes Unternehmen hat einen vollständigen eigenen Bücherkreis. Implementierung: `src/domain/company.ts` und `src/domain/invoice.ts`.

Das Stammkapital kann unter dem GmbH-Minimum liegen (`GMBH_MINIMUM_CAPITAL_CENTS`). Die 25-%-Rücklagenpflicht nach §5a Abs. 3 GmbHG:

- Basis ist der Jahresüberschuss abzüglich eines Verlustvortrags aus dem Vorjahr. Eine negative Basis ergibt keine Zuweisung.
- Die Zuweisung ist ein Viertel dieser Basis (`RESERVE_NUMERATOR` / `RESERVE_DENOMINATOR`), kaufmännisch auf den Cent gerundet.
- Die Pflicht besteht, solange das Stammkapital unter dem GmbH-Minimum liegt. Sie endet nicht, wenn die Rücklage selbst dieses Minimum erreicht.
- Die Rücklage darf zum Ausgleich eines Verlusts oder später zur Umwandlung in Stammkapital verwendet werden. Nur eine Kapitalerhöhung, die das GmbH-Minimum erreicht, beendet nach ihrer Eintragung die UG-Regeln. Das Erfassen von Stammkapital in der App ist nicht diese Eintragung.

Implementierung: `src/domain/reserve.ts`.

## Umsatzsteuer und die Kleinunternehmerregelung

Regelmäßiger und ermäßigter Steuersatz: `STANDARD_VAT_BPS`, `REDUCED_VAT_BPS`. Die Umsatzsteuer wird je Steuersatz einmal auf die Summe der Nettobeträge berechnet und dann kaufmännisch auf den Cent gerundet. Implementierung: `src/domain/vat.ts`.

§19 UStG in der seit 2025 geltenden Fassung, implementiert in `src/domain/tax.ts`:

- Der Umsatz des vorangegangenen Kalenderjahres darf `KLEIN_PRIOR_CENTS` nicht überschreiten.
- Das laufende Kalenderjahr darf `KLEIN_CURRENT_CENTS` nicht überschreiten. Wird es überschritten, endet die Befreiung für diesen Umsatz.
- Im Gründungsjahr ist die hier verwendete Obergrenze für das laufende Jahr `KLEIN_FOUNDING_CENTS` (Praxis der Finanzverwaltung).
- Eine Kleinunternehmer-Rechnung zeigt keinen Umsatzsteuersatz und keinen Umsatzsteuerbetrag. Sie trägt `KLEINUNTERNEHMER_NOTE` aus `src/domain/invoice.ts`. Das Ausweisen von Umsatzsteuer kann nach §14c UStG eine Steuerschuld begründen, daher wird die Ausstellung blockiert.
- Der Erlös im Journal ist nur ein Näherungswert. §19 verwendet vereinnahmte Entgelte, und der Vorjahreswert ist ein Feld, das der Benutzer pflegt. Die Prüfung warnt. Sie blockiert die Ausstellung wegen dieses Näherungswerts nicht.
- Der Gewinn der UG, einschließlich des Gewinns aus diesen Rechnungen, bleibt in der Gesellschaft. `estimateCorporateTax` ist die Planungsgröße für Körperschaftsteuer, Solidaritätszuschlag und Gewerbesteuer. Dieser Gewinn ist kein Einkommen in der Einkommensteuererklärung des Gesellschafters (Anlage G oder Anlage S).

Die Obergrenzen sind die seit 2025 geltenden Werte. Die frühere Vorjahresobergrenze von 22.000 Euro wird nicht verwendet. Der Verzicht auf die Befreiung ist eine Entscheidung, die mit einem Steuerberater abzustimmen ist. Die App errät nicht den bindenden Zeitraum.

## Rechnungen und Geschäftsbriefe

Die Ausstellung wird blockiert, bis der Entwurf die Angaben nach §14 UStG enthält: beide Adressen, Steuernummer oder USt-IdNr., Daten und mindestens eine beschriebene Position. Bei einer Kapitalgesellschaft (UG, GmbH, AG) kommen die Geschäftsbriefangaben nach §35a GmbHG hinzu: Registergericht, Registernummer und Geschäftsführung. Ein Einzelunternehmen oder eine Personengesellschaft braucht diese drei Felder nicht. Die App vergibt beim Ausstellen eine lückenlose Nummer `prefix + year + sequence`; die laufende Nummer gilt je Unternehmen. Das Stornieren bucht eine Gegenjournalzeile und verwendet die Nummer nicht erneut.

Eine Rechnung weist ihre Beträge als Nettopreise mit zusätzlicher Umsatzsteuer oder als Bruttopreise mit enthaltener Umsatzsteuer aus. Die Wahl wird je Rechnung in `invoices.amount_display` gespeichert und ändert nur die Darstellung: Buchführung und E-Rechnung führen Netto und Umsatzsteuer getrennt, und der Steuerbetrag steht in beiden Formen auf der Rechnung. In der Bruttoform sind die Positionsbeträge die Umsatzsteuer je Steuersatz aus `summarizeVat`, nach größtem Rest auf die Positionen dieses Satzes verteilt (`allocateLineVat`); die Spalte summiert sich dadurch centgenau auf die Rechnungssumme. Eine Rechnung nach §19 UStG hat keine Umsatzsteuer und zeigt einen Betrag.

## E-Rechnung (XRechnung)

Die E-Rechnung, die dieser Schreibtisch schreibt, ist eine XRechnung-3.0.2-Datei in UBL-Syntax. Das ist eine EN-16931-Rechnung und damit eine E-Rechnung nach §14 UStG. Die Spezifikation steht unter <https://xeinkauf.de/xrechnung/>. Die Datei wird beim Download erzeugt. Sie wird nicht gespeichert und nicht versendet. Der Rechnungsbildschirm kann die erzeugte Datei mit dem auf diesem Computer laufenden KoSIT-Validator prüfen; das Prüfergebnis wird nicht gespeichert. ZUGFeRD wird nicht erzeugt. Eine stornierte Rechnung bleibt eine Gegenjournalzeile; der Schreibtisch schreibt keine Gutschrift.

Implementierung: `src/domain/xrechnung.ts`. Spezifikationskennungen: `XRECHNUNG_CUSTOMIZATION_ID`, `XRECHNUNG_PROFILE_ID`. Die Menge verwendet `XRECHNUNG_UNIT_CODE` (UNECE Rec 20 Code C62, „one“). Die Rechnung hat keine Maßeinheit.

Die Ausstellung folgt weiterhin nur §14 und §35a. Die zusätzlichen XRechnung-Felder blockieren die Ausstellung nicht. Sie blockieren die Datei.

Der Kundentyp entscheidet, was BT-10 enthalten muss. `customers.kind` ist `business` (B2B), `public` (B2G) oder `private` (B2C); Zeilen aus der Zeit vor der Spalte gelten als `business`.

- Die XRechnung (BR-DE-15) verlangt BT-10 bei B2B und B2G. Die E-Rechnungsprüfung setzt das durch; das Rechnungsformular zeigt es als Hinweis, ohne die Ausstellung zu blockieren.
- Bei einer öffentlichen Auftraggeberin muss BT-10 eine Leitweg-ID sein. Der Schreibtisch prüft den Aufbau nach der Leitweg-ID-Formatspezifikation v2.0.2 und die Prüfziffern nach ISO/IEC 7064 MOD 97-10. KoSIT selbst prüft nur, dass BT-10 vorhanden ist.
- Bei einem Unternehmen ist BT-10 die vom Kunden vorgegebene Referenz, etwa eine Bestell- oder Projektnummer, oder `nicht zutreffend`, wenn es keine gibt.
- Eine Privatperson (B2C) braucht keine E-Rechnung. Der Schreibtisch erzeugt für diese Rechnung keine XRechnung und sagt das auf dem Rechnungsbildschirm.
- Die Käuferreferenz (BT-10) wird auf der Rechnung gespeichert. ZUGFeRD wird nicht erzeugt, daher gibt es keinen Profilwechsel.
- Die elektronischen Adressen von Verkäufer und Käufer sind die E-Mail-Adressen, Schema EM (BT-34, BT-49).
- Der Verkäuferkontakt ist die Geschäftsführung, die Telefonnummer der Gesellschaft und die E-Mail-Adresse der Gesellschaft.
- Die Zahlung ist eine SEPA-Überweisung (Code 58) mit einer prüfsummengültigen IBAN. Eine BIC wird nur aufgenommen, wenn sie vorhanden und wohlgeformt ist.
- 19 % und 7 % sind Umsatzsteuerkategorie S. Eine Datei der Kategorie S benötigt die USt-IdNr. des Verkäufers. Eine deutsche Adresse benötigt eine DE-Nummer mit neun Ziffern. Der Schreibtisch prüft die Prüfsumme der USt-IdNr. nicht.
- 0 % ist Kategorie E und benötigt einen Befreiungssatz (BT-120). Eine Kleinunternehmer-Rechnung verwendet `KLEINUNTERNEHMER_NOTE`.
- Umsatzsteuerbeträge sind dieselben Cent wie bei `summarizeVat`. Ein Vorauszahlungsbetrag reduziert den zu zahlenden Betrag (BT-115). Eine vollständig bezahlte Rechnung bleibt eine Rechnung mit einem zu zahlenden Betrag von null.
- Registergericht, HRB-Nummer und Geschäftsführung werden bei einer Kapitalgesellschaft in BT-33 geschrieben. Die HRB-Nummer ist außerdem BT-30. Bei anderen Rechtsformen werden stattdessen Rechtsform und Inhaber geschrieben.
- Dem Schreibtisch bekannte Ländernamen und ISO-Alpha-2-Codes werden zum Ländercode. Ein unbekanntes Land blockiert die Datei.

## Bücher

Das Journal ist doppelt geführt und nur anhängend. Jede Buchung wird in `src/domain/postings.ts` erzeugt und abgelehnt, wenn sie nicht ausgeglichen ist.

Der Kontenrahmen ist ein SKR03-Arbeitskontenrahmen für eine Dienstleistungs-UG, kein zertifizierter DATEV-Export. Bekannte Konten (Bank 1200, Forderungen 1400, Umsatzsteuer 1776 / 1771, Vorsteuer 1576 / 1571, Verbindlichkeiten gegenüber Gesellschaftern 1700, Verbindlichkeiten aus Lohn und Gehalt 1740, Erlöse 8400 / 8300 / 8192) folgen dem üblichen SKR03-Gebrauch. Der Gewinn vor Steuern ignoriert Konten mit `pnl: "tax"`, damit eine gebuchte Steuerzahlung nicht als Betriebsausgabe behandelt und dann erneut besteuert wird.

Körperschaft-, Solidaritäts- und Gewerbesteuer sind eine Planungsschätzung in `estimateCorporateTax`:

- Die steuerliche Basis ist der Gewinn vor Steuern abzüglich eines gespeicherten Verlustvortrags, mindestens null.
- Eine UG hat keinen Gewerbesteuer-Freibetrag.
- Die Gewerbesteuer wird in dieser Schätzung nicht noch einmal innerhalb der Körperschaftsteuerbasis abgezogen.
- Der Hebesatz ist der kommunale Hebesatz der Gesellschaft, keine bundesweite Konstante.

## Gesellschafterdarlehen

Ein Darlehen eines Gesellschafters ist Finanzierung, kein Gehalt. `shareholder_loans` speichert die Vereinbarung und die erste Auszahlung; `shareholder_loan_movements` speichert weitere Auszahlungen, Tilgungen und Zinsen. `loanOutstandingCents` in `src/domain/shareholder-loan.ts` addiert eine Auszahlung und zieht eine Tilgung ab. Zinsen ändern das Kapital nicht.

Die Buchungen in `src/domain/postings.ts`:

- Eine Auszahlung belastet die Bank und erkennt `ACCOUNTS.shareholdersPayable` (1700) als Verbindlichkeit.
- Eine Tilgung belastet 1700 und erkennt die Bank. Eine Tilgung darf das offene Darlehen nicht überschreiten.
- Zinsen belasten `ACCOUNTS.interestExpense` (7300). Gezahlte Zinsen erkennen die Bank; nicht gezahlte Zinsen erkennen 1700 und bleiben eine Verbindlichkeit.

Zinsen sind Finanzierungsaufwand, kein Gehalt und kein Gehaltsbestandteil. `reviewShareholderLoan` warnt, wenn ein offenes Darlehen keine Zinsen trägt und wenn ein Vermerk fehlt. Ein zinsloses Gesellschafterdarlehen kann steuerliche Folgen haben; der Schreibtisch entscheidet nicht über den fremdüblichen Zins. Die Unterlagen sind wie das übrige Journal nur anhängend; für ein gebuchtes Darlehen gibt es keine Löschaktion.

## Personen, Sozialversicherung, Gesundheit

Die Obergrenzen, Sätze, die Minijob-Grenze und der Faktor F für 2026 sind die Konstanten in `src/domain/rates-2026.ts`. Die Minijob-Grenze wird aus dem Mindestlohn abgeleitet (Lohn × 130 / 3, auf einen ganzen Euro aufgerundet). Der Faktor F ist der veröffentlichte vierstellige Faktor, geprüft gegen 28 % / den durchschnittlichen Gesamtsatz.

`src/domain/social.ts`:

- Eine Geschäftsführung mit mehr als der Hälfte der Anteile gilt als nicht sozialversichert, wenn der Status „automatisch“ ist. Das ist eine Voreinstellung, keine Statusfeststellung.
- Auszubildende verwenden bei jedem Entgelt die normale Formel.
- Andernfalls wählt das Entgeltband Minijob, Übergangsbereich oder regulär.
- Der Midijob verwendet die beiden Bemessungsgrundlagen in §20 Abs. 2a SGB IV. Der Arbeitgeber zahlt den Rest des vollen Beitrags. Der Zuschlag zur Pflegeversicherung für Kinderlose bleibt beim Beschäftigten, auf die volle Midijob-Basis. Kinderabschläge reduzieren nur den Beschäftigten.
- Sachsen verwendet die ungleiche Aufteilung der Pflegeversicherung.
- Die Insolvenzgeldumlage wird für reguläres Entgelt und Midijob-Entgelt geschätzt. U1/U2 werden nicht geschätzt.
- Arbeitgeberpauschalen beim Minijob: Rente, Gesundheit nur, wenn die Person gesetzlich krankenversichert ist, und die 2-%-Pauschalsteuer, wenn sie eingeschaltet ist. Die Rentenversicherung des Beschäftigten ist die veröffentlichte Pauschale, sofern er nicht darauf verzichtet.
- Lohnsteuer wird nie berechnet. Eine Lohnbuchung fragt danach.
- `payrollAmounts` macht aus der Schätzung Buchungszahlen. Die Sozialversicherung des Beschäftigten wird einbehalten. Die Arbeitgeber-Sozialversicherung schließt die Minijob-Pauschalsteuer aus, die separat gebucht wird. Eine Minijob-Buchung ignoriert einen eingegebenen Lohnsteuerbetrag. Ein sozialversicherungsfreies Gehalt kann trotzdem Lohnsteuer tragen, weil der Lohnsteuerabzug von der Sozialversicherung getrennt ist.

`payslip` macht aus der Schätzung und der eingegebenen Lohnsteuer die Abrechnungsansicht: Brutto, jeden Arbeitnehmer- und Arbeitgeberanteil, die Lohnsteuer, den Nettolohn und den Arbeitgeberaufwand. Solange keine Lohnsteuer eingegeben ist, zeigt der Personenbildschirm diese Zeile als offen, weil die Lohnsteuer nie berechnet wird. Das Lohnformular zeigt dieselbe Tabelle mit dem eingegebenen Betrag; der Nettolohn entspricht der gebuchten Auszahlung.

Ein Gehalt kann sich über die Zeit ändern. `salary_periods` hält je Änderung eine Zeile: das Datum, ab dem sie gilt, und das Monatsbrutto. `salaryForMonth` liefert die letzte Änderung, die nicht nach dem Abrechnungsmonat liegt, sonst das Vertragsbrutto in `employees.gross_monthly_cents`. Eine Änderung mit Datum innerhalb eines Monats gilt für diesen ganzen Monat. Der Personenbildschirm zeigt den Verlauf und die nächste Änderung; das Lohnformular schlägt den Betrag des gewählten Monats vor, und eine Einmalzahlung, ein Bonus oder ein angebrochener Monat wird beim Buchen selbst als Brutto eingetragen. Gebucht wird, was bestätigt wurde, nicht was der Verlauf vorgeschlagen hat.

Die Krankenversicherung einer geschäftsführenden Gesellschafterin oder eines geschäftsführenden Gesellschafters ist ein Policeneintrag (privat oder freiwillig gesetzlich), kein Lohnabzug. Verlängerungsdaten erscheinen als Erinnerungen.

`founder_health` ergänzt die gründerspezifische Sicht auf diese Versicherung: die Art (`private` oder `voluntary_statutory`), den Versicherer, den Monatsbeitrag, den Beginn des Versicherungsschutzes, das Statusfeststellungsverfahren (`not_required`, `requested`, `completed`), sein Datum und das Ergebnis (`open`, `not_socially_insured`, `socially_insured`). Je Geschäftsführung und Unternehmen gibt es eine Zeile.

`reviewFounderHealth` in `src/domain/founder-health.ts` ist eine Erinnerungsliste:

- Fehlende Versicherung oder eine Versicherung ohne Monatsbeitrag wird gemeldet.
- Ein offenes Statusverfahren wird gemeldet.
- Ein abgeschlossenes Verfahren ohne Datum wird gemeldet.
- Eine Geschäftsführung mit der Hälfte der Anteile oder weniger braucht oft ein Statusfeststellungsverfahren; `not_required` wird dann gemeldet.

Der Beitrag wird nicht über die Lohnabrechnung gebucht und nicht einbehalten. Die Krankenkasse entscheidet den Status; managr hält fest, was der Benutzer bestätigt, und entscheidet den Sozialversicherungsstatus nicht.

## Geschäftsführeranstellungsvertrag

Ein schriftlicher Anstellungsvertrag der Geschäftsführung legt das Gehalt im Voraus fest. `director_contracts` speichert das Unterschriftsdatum (`signed_on`), den Beginn der Laufzeit (`valid_from`), ein optionales Ende (`ended_on`) und das feste Monatsbrutto. Eine Person kann nacheinander mehrere Verträge haben; `currentDirectorContract` in `src/domain/director-contract.ts` liefert den Vertrag, der an einem Datum gilt, und ignoriert einen zukünftigen Vertrag.

Die Server-Action und das MCP-Werkzeug lehnen ein Unterschriftsdatum nach dem Beginn der Laufzeit ab. Das ist die Formvorgabe hinter der Erinnerung: Eine rückwirkende Gehaltsvereinbarung kann eine verdeckte Gewinnausschüttung sein. Ein Brutto von null ist erlaubt, solange die Geschäftsführung kein Gehalt nimmt; die Prüfung sagt das.

`reviewDirectorContract` ist eine Erinnerungsliste, keine Beurteilung:

- Ein fehlender Vertrag wird gemeldet, weil das Gehalt schriftlich vereinbart sein muss.
- Ein Vertragsbrutto, das vom Vertragsbrutto der Person abweicht, wird gemeldet; beide Werte sollen dasselbe feste Gehalt beschreiben.
- Jede Gehaltsänderung braucht einen Gesellschafterbeschluss mit Datum an oder vor der Änderung. Fehlt er, wird das gemeldet, weil die Änderung sonst rückwirkend wäre.

Der Schreibtisch hält den Vertrag fest. Er entscheidet nicht, ob der Vertrag wirksam, das Gehalt angemessen oder die Zahlung möglich ist.

## Gehalt an den Gesellschafter-Geschäftsführer

Eine Geschäftsführung, die auch Anteile hält, wird über die Lohnabrechnung bezahlt, aber das Geld bewegt sich anders. Ist die Person mit einem Gesellschaftereintrag verknüpft (`employees.shareholder_id`), bucht die Lohnabrechnung den Nettolohn auf `ACCOUNTS.shareholdersPayable` (1700) statt auf Bank oder Verbindlichkeiten aus Lohn und Gehalt. `buildShareholderPayout` tilgt diese Verbindlichkeit gegen die Bank. Die Auszahlung ist nicht das Gehalt: Das Gehalt ist bereits als Aufwand gebucht.

`reviewDirectorSalary` ist eine Erinnerungsliste, keine Beurteilung:

- Das Gehalt muss vorab durch Gesellschafterbeschluss vereinbart sein. Ein Beschluss, der nach Beginn des Gehalts datiert ist, gilt als rückwirkende Vereinbarung und kann eine verdeckte Gewinnausschüttung sein.
- Das Gehalt muss angemessen sein. Der Teil, den eine fremde Geschäftsführung nicht bekäme, kann eine verdeckte Gewinnausschüttung sein und ist dann keine Betriebsausgabe.
- Eine Geschäftsführung mit Anteilen sollte mit dem Gesellschaftereintrag verknüpft sein, damit Gehalt, Auszahlung und Beschluss zusammenbleiben.

Ein Beschluss der Art `salary`, der die Person nennt (`resolutions.employee_id`), erfüllt die Erinnerung an die Unterlagen. managr entscheidet nicht, ob der Beschluss wirksam oder der Betrag angemessen ist, und blockiert keine Buchung.

Eine Gewinnausschüttung läuft getrennt: `buildProfitDistribution` belastet den Gewinnvortrag (0860) und erkennt die Bank. Sie braucht einen Gesellschafterbeschluss und einen festgestellten Jahresabschluss und ist kein Gehalt und keine Betriebsausgabe. Der Schreibtisch hält die Bestätigung fest, nicht die rechtliche Wirkung.

## Pflichten

`src/domain/obligations.ts` erzeugt gesetzliche Termine. Wochenend- und bundesweite Feiertagsverschiebungen verwenden §108 AO. Es kennt nicht jeden Landesfeiertag, und der Bildschirm sagt das. Termine für Vorauszahlungen sind die üblichen Termine des Kalenderjahres; der Bescheid gilt. Fristen für Jahreserklärungen sind das Ende des 7. Monats nach dem Geschäftsjahr oder der 14. Monat, wenn ein Steuerberater gekennzeichnet ist. Die Offenlegung ist das Ende des 12. Monats nach dem Geschäftsjahr.

## Zeit

Arbeitszeitwarnungen folgen §3 und §4 ArbZG (8 Stunden, 10-Stunden-Grenze, 30- und 45-Minuten-Pausen). Der Mindesturlaub skaliert 24 Werktage mit der Arbeitswoche (BUrlG). Das Wochentagsmuster ist „die ersten N Tage der Woche“, eine Annahme, die der Personenbildschirm nennt.

## Dokumente und rechtliche Unterlagen

Dokumente sind Dateien plus eine Kategorie. Beschlüsse und die Compliance-Checkliste sind Aufzeichnungen, keine erzeugten Rechtsdokumente.

## Quellen und Erklärungen

`src/content/sources.ts` enthält das kuratierte Quellenregister und die Erklärungen in der App. Eine Quelle nennt genau eine offizielle https-Adresse, ihren Herausgeber und ihren Gegenstand; das Register ist unter `/sources` nach Domain gruppiert. Ein Leitfaden gehört zu einem Bildschirm, hat eine kurze Zusammenfassung und Abschnitte und listet die Quellen, auf die er sich stützt. Die Info-Spalte und das Register lesen dieselben Daten.

Das Register ist eine Lesehilfe. Eine Quelle ist nur für das maßgeblich, was ihr Herausgeber sagt, und ein Leitfaden ist kein rechtliches oder steuerliches Urteil. Widersprechen sich diese Datei und ein Leitfaden, gewinnen diese Datei und das hier genannte TypeScript-Modul. Zahlen stehen weiterhin nur in `src/domain/rates-2026.ts`.

Der Assistent und MCP-Clients lesen dieselben Daten über `read_guides` und `read_sources`. Beide Werkzeuge funktionieren ohne Web-Zugriff, und keines bucht ins Journal.
