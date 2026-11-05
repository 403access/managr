---
slug: /xrechnung-validation
---

# Checking an XRechnung file

The desk does not validate the XRechnung it renders. This note records how a file can be checked on demand, as of 5 November 2026.

## The Baden-Württemberg validator

<https://erechnungsvalidator.service-bw.de/> is a React single-page app. It publishes no API documentation, no OpenAPI description, and no client library.

It does call a JSON endpoint of its own:

```
POST https://erechnungsvalidator.service-bw.de/api/validate
```

The request is `multipart/form-data` with one field, `erechnung`, and an XML body. The response is JSON:

```jsonc
{
  "invoice":  { "id": "123456XX", "issueDate": "2016-04-04", "seller": "[Seller name]" },
  "metadata": { "filename": "valid.xml", "filesizeBytes": 6742, "validationTime": "5.11.2026 8:56:38" },
  "validation": {
    "valid": true,                       // XSD and Schematron, no errors
    "acceptable": true,                  // business accept/reject recommendation
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

The endpoint is not documented and not versioned. It is an internal detail of the web page and can change or be blocked without notice. It has no CORS headers, so a browser cannot call it cross-origin; a server must call it. It sits behind an F5 WAF and has no SLA.

| Case | Result |
| --- | --- |
| Valid invoice | 200, `valid: true` |
| Invalid invoice | 200, `valid: false` |
| Missing `erechnung` field | 400 |
| Empty file | 500 |
| More than 15 MB | 413 |

A successful HTTP status is not the verdict. Both the valid and the invalid file return 200; read `validation.valid` and `validation.acceptable`. The `report` is HTML, so rule codes such as `BR-DE-…` can only be scraped from it. The page is XML only: UBL and CII, not ZUGFeRD PDF.

The page's own report says it runs KoSIT Validator 1.5.0.

## The KoSIT validator

The engine is open source under Apache-2.0:

- Engine: <https://github.com/itplr-kosit/validator>, also `org.kosit:validator` on Maven Central.
- XRechnung configuration: <https://github.com/itplr-kosit/validator-configuration-xrechnung>.

Versions on 5 November 2026: engine 1.6.3 (20 August 2026) and configuration 2026-08-31 for XRechnung 3.0.2. The 1.5 line is frozen and unsupported; 1.6 receives maintenance only.

Command line, one report per file:

```bash
java -jar validator-1.6.3-standalone.jar -s scenarios.xml -r . -o out invoice.xml
```

The report is XML, not HTML, and carries the rule code, level, and XPath location:

```xml
<rep:message id="val-sch.2.1" level="information"
             xpathLocation="/Q{…}Invoice[1]" code="BR-DE-TMP-32">
  [BR-DE-TMP-32] Eine Rechnung sollte …
</rep:message>
```

Daemon mode gives an HTTP endpoint:

```bash
java -jar validator-1.6.3-standalone.jar -s scenarios.xml -r . -D -G -P 8080

curl -X POST http://localhost:8080/invoice.xml \
  -H 'Content-Type: application/xml' \
  --data-binary @invoice.xml
```

The daemon answers 200 for an acceptable file, 406 for a rejected one, and 400, 422, or 500 for request and configuration errors. `GET /server/health` reports status. It expects the XML as the raw body; it does not accept `multipart/form-data`.

KoSIT publishes no Docker image. The repository builds its own in `docker/validator/Dockerfile`: Temurin 21 JRE on Alpine, the pinned standalone JAR, and the pinned XRechnung configuration, both verified by SHA-256. The daemon runs with the GUI off.

## In this repository

`docker compose up --build` starts the desk, the site, and the validator. The validator publishes `127.0.0.1:8090` on the host; inside the Compose network it is `http://validator:8080`. Compose sets `VALIDATOR_URL` for the desk to that internal address. A desk started with `bun dev` falls back to `http://127.0.0.1:8090`, so the validator container has to be running.

The invoice screen has a check button next to the download. It renders the file, posts it to the validator, and shows the verdict with the rule messages. `src/server/validator.ts` makes the call; `src/server/validator-report.ts` parses the KoSIT report and is covered by `tests/validator-report.test.ts`.

```bash
curl -X POST http://127.0.0.1:8090/invoice.xml \
  -H 'Content-Type: application/xml' \
  --data-binary @invoice.xml
```

To update the rules, change `VALIDATOR_ASSET`, `CONFIG_ASSET`, and the two SHA-256 values in the Dockerfile together. The asset ids come from the release pages linked in the file.

## Recommendation

Use the self-hosted KoSIT daemon to check every generated invoice, in tests and on demand. The rules are the same ones the BW page applies, the report is structured, and the service cannot rate-limit or change under the desk.

Use the BW endpoint only for occasional spot checks, called from the server, and treat its result as a convenience rather than a contract.
