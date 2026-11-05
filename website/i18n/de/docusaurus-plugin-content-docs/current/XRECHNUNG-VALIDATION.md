---
slug: /xrechnung-validation
---

# Eine XRechnung-Datei prüfen

Der Schreibtisch validiert die XRechnung, die er erzeugt, nicht. Diese Notiz hält fest, wie eine Datei auf Anfrage geprüft werden kann, Stand 5. November 2026.

## Der Validator Baden-Württemberg

<https://erechnungsvalidator.service-bw.de/> ist eine React-Single-Page-App. Sie veröffentlicht keine API-Dokumentation, keine OpenAPI-Beschreibung und keine Client-Bibliothek.

Sie ruft einen eigenen JSON-Endpunkt auf:

```
POST https://erechnungsvalidator.service-bw.de/api/validate
```

Die Anfrage ist `multipart/form-data` mit einem Feld, `erechnung`, und einem XML-Body. Die Antwort ist JSON:

```jsonc
{
  "invoice":  { "id": "123456XX", "issueDate": "2016-04-04", "seller": "[Seller name]" },
  "metadata": { "filename": "valid.xml", "filesizeBytes": 6742, "validationTime": "5.11.2026 8:56:38" },
  "validation": {
    "valid": true,                       // XSD und Schematron, keine Fehler
    "acceptable": true,                  // geschäftliche Annahme-/Ablehnungsempfehlung
    "validityExplanation": "Das geprüfte Dokument enthält weder Fehler noch Warnungen. …",
    "acceptabilityExplanation": "Es wird empfohlen das Dokument anzunehmen …",
    "report": "<html>…Prüfbericht…</html>"
  }
}
```

```bash
curl -sS -X POST https://erechnungsvalidator.service-bw.de/api/validate \
  -F "erechnung=@invoice.xml;type=application/xml"
```

Der Endpunkt ist nicht dokumentiert und nicht versioniert. Er ist ein internes Detail der Webseite und kann sich ohne Vorankündigung ändern oder blockiert werden. Er hat keine CORS-Header, daher kann ein Browser ihn nicht ursprungsübergreifend aufrufen; ein Server muss ihn aufrufen. Er liegt hinter einer F5-WAF und hat kein SLA.

| Fall | Ergebnis |
| --- | --- |
| Gültige Rechnung | 200, `valid: true` |
| Ungültige Rechnung | 200, `valid: false` |
| Fehlendes Feld `erechnung` | 400 |
| Leere Datei | 500 |
| Mehr als 15 MB | 413 |

Ein erfolgreicher HTTP-Status ist nicht das Urteil. Sowohl die gültige als auch die ungültige Datei liefern 200; lies `validation.valid` und `validation.acceptable`. Der `report` ist HTML, daher können Regelcodes wie `BR-DE-…` nur daraus ausgelesen werden. Die Seite ist nur XML: UBL und CII, kein ZUGFeRD-PDF.

Der Prüfbericht der Seite selbst sagt, dass sie KoSIT Validator 1.5.0 ausführt.

## Der KoSIT-Validator

Die Engine ist Open Source unter Apache-2.0:

- Engine: <https://github.com/itplr-kosit/validator>, auch `org.kosit:validator` auf Maven Central.
- XRechnung-Konfiguration: <https://github.com/itplr-kosit/validator-configuration-xrechnung>.

Versionen am 5. November 2026: Engine 1.6.3 (20. August 2026) und Konfiguration 2026-08-31 für XRechnung 3.0.2. Die 1.5-Linie ist eingefroren und wird nicht unterstützt; 1.6 erhält nur Wartung.

Kommandozeile, ein Bericht pro Datei:

```bash
java -jar validator-1.6.3-standalone.jar -s scenarios.xml -r . -o out invoice.xml
```

Der Bericht ist XML, nicht HTML, und trägt Regelcode, Stufe und XPath-Position:

```xml
<rep:message id="val-sch.2.1" level="information"
             xpathLocation="/Q{…}Invoice[1]" code="BR-DE-TMP-32">
  [BR-DE-TMP-32] Eine Rechnung sollte …
</rep:message>
```

Der Daemon-Modus bietet einen HTTP-Endpunkt:

```bash
java -jar validator-1.6.3-standalone.jar -s scenarios.xml -r . -D -G -P 8080

curl -X POST http://localhost:8080/invoice.xml \
  -H 'Content-Type: application/xml' \
  --data-binary @invoice.xml
```

Der Daemon antwortet mit 200 für eine akzeptable Datei, 406 für eine abgelehnte und 400, 422 oder 500 bei Anfrage- und Konfigurationsfehlern. `GET /server/health` meldet den Status. Er erwartet das XML als rohen Body; er akzeptiert kein `multipart/form-data`.

KoSIT veröffentlicht kein Docker-Image. Das Repository baut sein eigenes in `docker/validator/Dockerfile`: Temurin 21 JRE auf Alpine, das gepinnte Standalone-JAR und die gepinnte XRechnung-Konfiguration, beide per SHA-256 geprüft. Der Daemon läuft mit ausgeschalteter GUI.

## In diesem Repository

`docker compose up --build` startet den Schreibtisch, die Website und den Validator. Der Validator veröffentlicht `127.0.0.1:8090` auf dem Host; im Compose-Netzwerk ist er unter `http://validator:8080` erreichbar. Compose setzt `VALIDATOR_URL` für den Schreibtisch auf diese interne Adresse. Ein mit `bun dev` gestarteter Schreibtisch fällt auf `http://127.0.0.1:8090` zurück, daher muss der Validator-Container laufen.

Der Rechnungsbildschirm hat eine Prüfschaltfläche neben dem Download. Er erzeugt die Datei, sendet sie an den Validator und zeigt das Urteil mit den Regelmeldungen. `src/server/validator.ts` führt den Aufruf aus; `src/server/validator-report.ts` parst den KoSIT-Bericht und wird von `tests/validator-report.test.ts` abgedeckt.

```bash
curl -X POST http://127.0.0.1:8090/invoice.xml \
  -H 'Content-Type: application/xml' \
  --data-binary @invoice.xml
```

Um die Regeln zu aktualisieren, ändere `VALIDATOR_ASSET`, `CONFIG_ASSET` und die beiden SHA-256-Werte im Dockerfile gemeinsam. Die Asset-IDs stammen von den in der Datei verlinkten Release-Seiten.

## Empfehlung

Verwende den selbst gehosteten KoSIT-Daemon, um jede erzeugte Rechnung in Tests und auf Anfrage zu prüfen. Die Regeln sind dieselben, die die BW-Seite anwendet, der Bericht ist strukturiert, und der Dienst kann den Schreibtisch weder durch Ratenbegrenzung ausbremsen noch sich unter ihm ändern.

Verwende den BW-Endpunkt nur für gelegentliche Stichproben, aufgerufen vom Server, und behandle sein Ergebnis als Annehmlichkeit, nicht als Vertrag.
