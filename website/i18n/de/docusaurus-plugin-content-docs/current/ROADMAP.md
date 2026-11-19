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
4. Das Gehalt eines Gesellschafter-Geschäftsführers sammelt sich als Verbindlichkeit gegenüber dem Gesellschafter, die Auszahlung tilgt sie, und eine getrennte Gewinnausschüttung verwendet den Gewinnvortrag. Gehaltsvereinbarungen sind Gesellschafterbeschlüsse, mit Erinnerungen an Beschluss und Angemessenheitsprüfung.
5. Ein Assistenten-Panel und ein MCP-Server stellen dieselben Werkzeuge bereit, die auch die Bildschirme nutzen, sodass eine Anfrage über Rechnungen, Bücher, Personen, Zeit und Fristen lesen und buchen kann. Es wird nichts versendet, und ein Cloud-Modell erhält das Gespräch nur, wenn es eingerichtet wurde.
6. Projekte verbinden Kunden, Aufgaben, Deliverables und Zeit. Die Auswertung zeigt Zeit je Projekt, Projektstarts und -abschlüsse, die Aufteilung in produktive und unproduktive Aufgaben sowie die Personen und Kunden hinter der Arbeit. Ein Kundenbericht druckt dieselben Zahlen und wird über den Browser-Druckdialog als PDF gespeichert.
7. Der Assistent liest Anbieter, Modelle und Zugangsdaten aus der lokalen opencode-Installation. Zwei durchsuchbare Felder wählen Anbieter und Modell; die Umgebungsvariablen bleiben der Rückfall, wenn opencode nicht installiert ist.
8. Der Assistent sucht im öffentlichen Web und liest eine Seite, wenn eine Tatsache nicht im Schreibtisch steht, nennt die Quell-URL und behandelt Seitentext als nicht vertrauenswürdige Daten. Der Web-Zugriff lässt sich für Assistent und MCP abschalten.
9. Unternehmensübergreifende Meilensteine halten übergeordnete Ziele mit Zieldatum, Status, Fortschritt, Kategorie und beliebig vielen Unternehmen. `/milestones` wertet die Ziele nach Status, Kategorie, Unternehmen und Quartal aus, und der MCP-Server stellt dieselbe Ansicht und dieselben Schreibvorgänge bereit.
10. Ein Geschäftsführervertrag erfasst Unterschriftsdatum, festes Brutto und Laufzeit; eine rückwirkende Unterschrift wird abgelehnt, und Gehaltsänderungen werden gegen einen Beschluss mit Datum an oder vor der Änderung geprüft.
11. Ein Gesellschafterdarlehen erfasst Auszahlungen, Tilgungen und Zinsen über das Journal. Der offene Betrag wird gezeigt, eine Überzahlung wird abgelehnt, und ein zinsloses Darlehen trägt einen steuerlichen Hinweis.
12. Die Krankenversicherung des Gründers erfasst private oder freiwillig gesetzliche Versicherung, den Beitrag und das Statusfeststellungsverfahren. Der Beitrag bleibt außerhalb der Lohnabrechnung; ein offenes oder fehlendes Statusverfahren wird gemeldet.
13. Eine schreibgeschützte Qonto-Bankverbindung je Unternehmen speichert Konten und Umsätze aus der Qonto-API und zeigt Salden, ein Jahr Umsätze und Filter. Die Umsätze werden nicht ins Journal gebucht.
14. Eine Geldflussseite folgt einem Jahr von der Rechnung bis zum Finanzamt: Bruttoumsatz geteilt in Einkäufe, Nettolöhne, Lohnsteuer, Sozialversicherung, Umsatzsteuer, Körperschaftsteuer, Solidaritätszuschlag, Gewerbesteuer und Gewinn, dazu die Umsatzsteuerkette und tatsächliche Bankbewegungen. Der MCP-Server stellt sie als `read_cashflow` bereit.
15. Ein Organigramm zeichnet die Berichtslinien aus der Führungskraft jeder Person, lässt ehemalige Personen aus dem Baum und lehnt Selbstverweis oder Schleife ab. Die Seite Personen und `read_org` nutzen dieselbe Ansicht.
16. Ein Quellenregister stellt jeder Erklärung die offiziellen Websites zur Seite und gruppiert die Quellen nach Domain. `/sources`, `read_guides` und `read_sources` lesen dieselben typisierten Daten.

## Gründervergütung — Roadmap aus dem Gespräch

Diese Roadmap übersetzt die Fragen des Gründers in Arbeitspakete: sich selbst aus einer UG bezahlen, Krankenversicherung, Sozialversicherung, verdeckte Gewinnausschüttung (vGA) und Monate mit weniger Umsatz. Sie ist eine Planungshilfe, keine Rechts- oder Steuerberatung.

### 1. Sich als Gesellschafter-Geschäftsführer bezahlen

- [x] Die Lohnbuchung erfasst Brutto, die eingegebene Lohnsteuer und die geschätzten Beiträge. Die Lohnsteuer wird nie berechnet.
- [x] Ein Gehaltsverlauf trägt Erhöhungen über die Zeit; das Lohnformular schlägt den Betrag für den Monat vor und bucht, was bestätigt wurde.
- [x] Der Nettolohn einer verknüpften Geschäftsführung sammelt sich als Verbindlichkeit gegenüber dem Gesellschafter (1700); eine Auszahlung tilgt sie.
- [x] Eine Gehaltsvereinbarung ist ein Gesellschafterbeschluss. Der Personenbildschirm erinnert, wenn er fehlt oder rückwirkend ist.
- [x] Ein unbezahlter Start ist möglich: Das Vertragsbrutto kann null sein.
- [x] Der schriftliche Geschäftsführervertrag mit Unterschriftsdatum, festem Brutto und Laufzeit wird erfasst.
- [x] Jede Gehaltsänderung wird gegen einen Beschluss mit Datum an oder vor der Änderung geprüft.
- [x] Die Angemessenheitserinnerung bleibt sichtbar; der Schreibtisch entscheidet nicht, ob ein Gehalt fremdüblich ist.

### 2. Ein Monat mit weniger Umsatz

- [x] Das feste Gehalt bleibt im Vertrag. Kann die Gesellschaft nicht zahlen, bleibt der Nettolohn eine Verbindlichkeit gegenüber dem Gesellschafter.
- [x] Ein Gesellschafterdarlehen mit Auszahlung, Tilgung, Zinsen und den Journalbuchungen wird erfasst.
- [x] Ein zinsloses Gesellschafterdarlehen wird gemeldet, weil die steuerliche Behandlung zu klären ist.
- [x] Die Auszahlung ist vom Gehaltsaufwand getrennt, damit ein gestundetes Gehalt nicht als neuer Aufwand gebucht wird.

### 3. Krankenversicherung und Sozialversicherungsstatus

- [x] Eine Geschäftsführung mit mehr als der Hälfte der Anteile gilt standardmäßig als nicht sozialversichert. Das ist keine Statusfeststellung.
- [x] Die Krankenversicherung ist ein Policeneintrag mit Verlängerungserinnerung; sie ist kein Lohnabzug.
- [x] Die Versicherung des Gründers wird als privat oder freiwillig gesetzlich erfasst, mit Beitrag und Beginn.
- [x] Das Statusfeststellungsverfahren und sein Ergebnis werden erfasst; ein offenes Verfahren bleibt sichtbar.
- [x] Die Sozialversicherungsschätzung sagt, dass Kranken- und Pflegeversicherung außerhalb der Lohnabrechnung liegen.

### 4. Steuern, Lohn und Buchhaltung

- [x] Monatliche Lohnbuchung, Lohnsteuereingabe sowie die Pflichten für Lohnsteuer und Sozialversicherung.
- [x] Getrennte Bücher je Unternehmen, ein Checklistenpunkt zum Geschäftskonto und keine privaten Entnahmen über das Journal.
- [x] Rechnungen im Namen der Gesellschaft, Umsatzsteuer, doppeltes Journal und Körperschaftsteuerschätzung.
- [x] Gesetzliche Rücklage nach §5a GmbHG, Verlustausgleich und Gewinnausschüttung aus dem Gewinnvortrag.
- [x] Pflichten für Umsatzsteuer, Lohnsteuer, Gewerbesteuer, Körperschaftsteuer, Offenlegung, IHK und Berufsgenossenschaft.

### 5. Verdeckte Gewinnausschüttung (vGA) vermeiden

- [x] Der Personenbildschirm verbindet Gesellschaftereintrag, Gehaltsbeschluss und Auszahlung.
- [x] Ein Beschluss, der nach Beginn des Gehalts datiert ist, wird als rückwirkend gemeldet.
- [x] Das Gehalt muss fremdüblich sein; der Überschuss kann eine vGA sein und ist keine Betriebsausgabe.
- [x] Ein Geschäftsführervertrag, der vor seiner Unterschrift beginnt, wird abgelehnt; ein abweichendes Vertragsbrutto wird gemeldet.
- [x] Jede Gehaltsänderung braucht einen Beschluss mit Datum an oder vor der Änderung.
- [x] Die Darlehensunterlagen behalten Datum und Vermerk, damit die Unterlagen nachvollziehbar bleiben.
- [x] Die Krankenversicherung behält Beginn, Beitrag und Ergebnis des Statusverfahrens.

### 6. Rücklage und der Weg zur GmbH

- [x] Ein Viertel des Jahresüberschusses geht in die gesetzliche Rücklage, solange das Stammkapital unter dem GmbH-Minimum liegt.
- [x] Die Rücklage kann einen Verlust ausgleichen; das Stammkapital steigt dadurch nicht.
- [x] Die Lücke zu 25.000 € wird gezeigt. Die Pflicht endet erst mit der eingetragenen Kapitalerhöhung, nicht wenn der Rücklagenbestand das Minimum erreicht.

## Nicht in Version 1

Diese Punkte brauchen ein externes System oder eine andere Produktentscheidung. Sie werden nicht als funktionierend vorgetäuscht.

- Anmeldung und Rollen.
- ZUGFeRD und die Übermittlung einer E-Rechnung (Peppol, ein Portal oder E-Mail). Der KoSIT-Validator läuft nur auf diesem Computer, wenn die Prüfschaltfläche benutzt wird; kein Werkzeug reicht eine Datei ein.
- DATEV-EXTF-Export und eine gesperrte DATEV-Kontenzuordnung.
- Bank-CSV-Import. Die Qonto-Verbindung ist lesend und bucht nichts.
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

## Fertig

Eine Version ist fertig, wenn die Domänentests bestehen, `bun run typecheck` und `bun run build` bestehen, die geänderten Bildschirme in Telefon- und Desktopbreite funktionieren und die Dokumentation, die das Verhalten beschreibt, zusammen mit dem Code aktualisiert wurde.
