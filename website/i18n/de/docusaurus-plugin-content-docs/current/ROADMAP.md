---
slug: /roadmap
---

# Roadmap

managr ist ein lokaler Schreibtisch für deutsche Unternehmen: Gesellschaftsdaten, Pflichten, Rechnungen, Bücher, Personen, Sozialversicherungsschätzungen, Zeit, Dokumente und rechtliche Unterlagen. Jedes Unternehmen führt eigene Bücher; ein Umschalter wechselt den ganzen Schreibtisch.

Entwicklungsregeln: `.grok/skills/managr-engineering/SKILL.md`.

## Version 1 — der Schreibtisch

In diesem Repository ausgeliefert. Ein Benutzer, mehrere Unternehmen mit getrennten Büchern, SQLite auf der Festplatte, kein Kontosystem.

- Stammdaten für UG, GmbH, AG, OHG, KG, GbR, PartG, e.K. und Einzelunternehmen, mit Unternehmensumschalter und getrennten Büchern je Unternehmen.
- Pflichtenkalender: Umsatzsteuer, Lohnsteuer, Gewerbesteuer, Körperschaftsteuer, Sozialversicherungserinnerungen, Offenlegung, IHK, Berufsgenossenschaft sowie eigene Fristen.
- Kunden, Rechnungen mit den gesetzlichen Angaben, Ausstellung, Zahlung, Storno und eine druckbare Rechnung.
- XRechnung 3.0.2 (UBL) zum Herunterladen für eine ausgestellte Rechnung. Die Datei ist eine E-Rechnung nach §14 UStG. Sie wird nicht übermittelt.
- Doppelte Buchführung auf einem SKR03-Arbeitskontenrahmen, Saldenliste, Gewinn vor Steuern und Körperschaftsteuerschätzung.
- Personen: Anstellung, Minijob-, Midijob- und reguläre Beitragsschätzungen für 2026, Urlaub und eine Lohnjournalbuchung. Die Lohnsteuer wird eingegeben, nicht berechnet.
- Krankenversicherung der Gründerin oder des Gründers und Betriebsversicherungen mit Verlängerungserinnerungen.
- Zeitaufzeichnungen und Aufgaben mit Arbeitszeitwarnungen.
- Dokumente, auf der Festplatte gespeichert.
- Rechtliche Checkliste und Gesellschafterbeschlüsse.
- Beispiel-UG, damit der Schreibtisch beim ersten Start nutzbar ist.
- Domänentests für die oben genannten Regeln.
- Layout, das auf dem Telefon und auf dem Desktop funktioniert.
- Oberfläche standardmäßig Deutsch, Englisch als zweite Sprache. Gedruckte Rechnungen bleiben Deutsch.

## Nach Version 1

Nach der ersten Version ausgeliefert, in dieser Reihenfolge:

1. Rechnungen weisen ihre Beträge als Nettopreise mit zusätzlicher Umsatzsteuer oder als Bruttopreise mit enthaltener Umsatzsteuer aus; die Wahl gilt je Rechnung.
2. Eine Abrechnungsansicht im Personenbildschirm und im Lohnformular zeigt jede Zeile: Brutto, jeden Beitrag je Seite, die eingegebene Lohnsteuer, den Nettolohn und den Arbeitgeberaufwand.
3. Ein Gehaltsverlauf trägt Erhöhungen über die Zeit; das Lohnformular schlägt den Betrag des gewählten Monats vor und bucht weiterhin den bestätigten Betrag.

## Nicht in Version 1

Diese Punkte brauchen ein externes System oder eine andere Produktentscheidung. Sie werden nicht als funktionierend vorgetäuscht.

- Anmeldung und Rollen.
- ZUGFeRD und die Übermittlung einer E-Rechnung (Peppol, ein Portal oder E-Mail). Der KoSIT-Validator wird nicht ausgeführt.
- DATEV-EXTF-Export und eine gesperrte DATEV-Kontenzuordnung.
- Bank-CSV oder ein Bank-Feed.
- ELSTER-Übermittlung.
- Lohnsteuer aus ELStAM, Kirchensteuer und Faktorregeln.
- DEÜV-Meldungen, Beitragsnachweise und U1/U2-Sätze (diese Sätze legt die einziehende Stelle fest).
- Rechnungen per E-Mail versenden.
- OCR auf Belegen.

## Später, in dieser Reihenfolge

1. Bank-CSV-Import, der über dieselben Journalregeln bucht.
2. DATEV-Export, sobald der Kontenrahmen gegen den Kontenrahmen der Kanzlei bestätigt ist.
3. Eine echte Lohnsteuerfunktion oder ein ausdrücklicher Import von Lohnabrechnungsergebnissen aus einem Lohnprogramm.
4. Anmeldung, erst wenn die Datei nicht mehr eine einzelne lokale Datenbank ist.

## Backlog

Gewünscht, noch nicht eingeplant. In der Reihenfolge, in der es aufkam; das ist keine Zusage.

1. **Gehalt als Auszahlung an den selbst angestellten Gesellschafter.** Das Gehalt eines Gesellschafter-Geschäftsführers als Auszahlung mit eigener Buchung und Unterlagen: Gesellschafterbeschluss, Angemessenheitsprüfung, damit daraus keine verdeckte Gewinnausschüttung wird, und die Trennung zwischen Gehalt und Gewinnausschüttung.

## Fertig

Eine Version ist fertig, wenn die Domänentests bestehen, `bun run typecheck` und `bun run build` bestehen, die geänderten Bildschirme in Telefon- und Desktopbreite funktionieren und die Dokumentation, die das Verhalten beschreibt, zusammen mit dem Code aktualisiert wurde.
