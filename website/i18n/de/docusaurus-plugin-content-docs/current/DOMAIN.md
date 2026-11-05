---
slug: /domain
---

# Domänenregeln

managr ist eine Planungshilfe. Es reicht nichts ein, beurteilt den Sozialversicherungsstatus nicht und berechnet keine Lohnsteuer. Die Oberfläche muss das überall sichtbar halten, wo sie eine Schätzung zeigt.

Wenn ein Satz hier dem Code widerspricht, gewinnt das unten genannte TypeScript-Modul, und diese Datei wird in derselben Änderung aktualisiert. Zahlen stehen nur in `src/domain/rates-2026.ts`. Kontonummern stehen nur in `src/domain/accounts.ts`.

## Gesellschaftsrecht

Eine Unternehmergesellschaft (haftungsbeschränkt) verwendet diese Bezeichnung oder die Kurzform UG (haftungsbeschränkt) in ihrem Namen. Die Rechnungsprüfung lehnt einen rechtlichen Namen ab, der keines von beiden enthält. Implementierung: `src/domain/invoice.ts`.

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

Die Ausstellung wird blockiert, bis der Entwurf die Angaben nach §14 UStG und die Geschäftsbriefangaben nach §35a GmbHG enthält: beide Adressen, Steuernummer oder USt-IdNr., Daten, mindestens eine beschriebene Position, Registergericht, Registernummer und Geschäftsführung. Die App vergibt beim Ausstellen eine lückenlose Nummer `prefix + year + sequence`. Das Stornieren bucht eine Gegenjournalzeile und verwendet die Nummer nicht erneut.

## E-Rechnung (XRechnung)

Die E-Rechnung, die dieser Schreibtisch schreibt, ist eine XRechnung-3.0.2-Datei in UBL-Syntax. Das ist eine EN-16931-Rechnung und damit eine E-Rechnung nach §14 UStG. Die Spezifikation steht unter <https://xeinkauf.de/xrechnung/>. Die Datei wird beim Download erzeugt. Sie wird nicht gespeichert und nicht versendet. Der Rechnungsbildschirm kann die erzeugte Datei mit dem auf diesem Computer laufenden KoSIT-Validator prüfen; das Prüfergebnis wird nicht gespeichert. ZUGFeRD wird nicht erzeugt. Eine stornierte Rechnung bleibt eine Gegenjournalzeile; der Schreibtisch schreibt keine Gutschrift.

Implementierung: `src/domain/xrechnung.ts`. Spezifikationskennungen: `XRECHNUNG_CUSTOMIZATION_ID`, `XRECHNUNG_PROFILE_ID`. Die Menge verwendet `XRECHNUNG_UNIT_CODE` (UNECE Rec 20 Code C62, „one“). Die Rechnung hat keine Maßeinheit.

Die Ausstellung folgt weiterhin nur §14 und §35a. Die zusätzlichen XRechnung-Felder blockieren die Ausstellung nicht. Sie blockieren die Datei.

- Die Käuferreferenz (BT-10) wird auf der Rechnung gespeichert. Bei einer öffentlichen Stelle ist sie die Leitweg-ID. Der Schreibtisch prüft diese Prüfsumme nicht.
- Die elektronischen Adressen von Verkäufer und Käufer sind die E-Mail-Adressen, Schema EM (BT-34, BT-49).
- Der Verkäuferkontakt ist die Geschäftsführung, die Telefonnummer der Gesellschaft und die E-Mail-Adresse der Gesellschaft.
- Die Zahlung ist eine SEPA-Überweisung (Code 58) mit einer prüfsummengültigen IBAN. Eine BIC wird nur aufgenommen, wenn sie vorhanden und wohlgeformt ist.
- 19 % und 7 % sind Umsatzsteuerkategorie S. Eine Datei der Kategorie S benötigt die USt-IdNr. des Verkäufers. Eine deutsche Adresse benötigt eine DE-Nummer mit neun Ziffern. Der Schreibtisch prüft die Prüfsumme der USt-IdNr. nicht.
- 0 % ist Kategorie E und benötigt einen Befreiungssatz (BT-120). Eine Kleinunternehmer-Rechnung verwendet `KLEINUNTERNEHMER_NOTE`.
- Umsatzsteuerbeträge sind dieselben Cent wie bei `summarizeVat`. Ein Vorauszahlungsbetrag reduziert den zu zahlenden Betrag (BT-115). Eine vollständig bezahlte Rechnung bleibt eine Rechnung mit einem zu zahlenden Betrag von null.
- Registergericht, HRB-Nummer und Geschäftsführung werden in BT-33 geschrieben. Die HRB-Nummer ist auch BT-30.
- Dem Schreibtisch bekannte Ländernamen und ISO-Alpha-2-Codes werden zum Ländercode. Ein unbekanntes Land blockiert die Datei.

## Bücher

Das Journal ist doppelt geführt und nur anhängend. Jede Buchung wird in `src/domain/postings.ts` erzeugt und abgelehnt, wenn sie nicht ausgeglichen ist.

Der Kontenrahmen ist ein SKR03-Arbeitskontenrahmen für eine Dienstleistungs-UG, kein zertifizierter DATEV-Export. Bekannte Konten (Bank 1200, Forderungen 1400, Umsatzsteuer 1776 / 1771, Vorsteuer 1576 / 1571, Erlöse 8400 / 8300 / 8192) folgen dem üblichen SKR03-Gebrauch. Der Gewinn vor Steuern ignoriert Konten mit `pnl: "tax"`, damit eine gebuchte Steuerzahlung nicht als Betriebsausgabe behandelt und dann erneut besteuert wird.

Körperschaft-, Solidaritäts- und Gewerbesteuer sind eine Planungsschätzung in `estimateCorporateTax`:

- Die steuerliche Basis ist der Gewinn vor Steuern abzüglich eines gespeicherten Verlustvortrags, mindestens null.
- Eine UG hat keinen Gewerbesteuer-Freibetrag.
- Die Gewerbesteuer wird in dieser Schätzung nicht noch einmal innerhalb der Körperschaftsteuerbasis abgezogen.
- Der Hebesatz ist der kommunale Hebesatz der Gesellschaft, keine bundesweite Konstante.

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

Die Krankenversicherung einer geschäftsführenden Gesellschafterin oder eines geschäftsführenden Gesellschafters ist ein Policeneintrag (privat oder freiwillig gesetzlich), kein Lohnabzug. Verlängerungsdaten erscheinen als Erinnerungen.

## Pflichten

`src/domain/obligations.ts` erzeugt gesetzliche Termine. Wochenend- und bundesweite Feiertagsverschiebungen verwenden §108 AO. Es kennt nicht jeden Landesfeiertag, und der Bildschirm sagt das. Termine für Vorauszahlungen sind die üblichen Termine des Kalenderjahres; der Bescheid gilt. Fristen für Jahreserklärungen sind das Ende des 7. Monats nach dem Geschäftsjahr oder der 14. Monat, wenn ein Steuerberater gekennzeichnet ist. Die Offenlegung ist das Ende des 12. Monats nach dem Geschäftsjahr.

## Zeit

Arbeitszeitwarnungen folgen §3 und §4 ArbZG (8 Stunden, 10-Stunden-Grenze, 30- und 45-Minuten-Pausen). Der Mindesturlaub skaliert 24 Werktage mit der Arbeitswoche (BUrlG). Das Wochentagsmuster ist „die ersten N Tage der Woche“, eine Annahme, die der Personenbildschirm nennt.

## Dokumente und rechtliche Unterlagen

Dokumente sind Dateien plus eine Kategorie. Beschlüsse und die Compliance-Checkliste sind Aufzeichnungen, keine erzeugten Rechtsdokumente.
