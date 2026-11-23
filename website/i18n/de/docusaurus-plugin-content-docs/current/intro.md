---
slug: /
sidebar_label: Überblick
---

# managr

Ein lokaler Schreibtisch für deutsche Unternehmen, auch die UG (haftungsbeschränkt) und ein Einzelunternehmen. Diese Seiten sind die Notizen in diesem Repository. Auf der veröffentlichten Website liegen sie unter `/docs`. Die Startseite beschreibt den Schreibtisch kurz.

Der Schreibtisch reicht keine Steuererklärung ein, berechnet keine Lohnsteuer und entscheidet nicht über den Sozialversicherungsstatus.

## Lesen

- [Architektur](./ARCHITECTURE.md) — wie die Next.js-Anwendung aufgebaut ist.
- [Domänenregeln](./DOMAIN.md) — Gesellschaftsrecht, Steuern, Rechnungen und die Zahlen, mit denen der Code arbeitet.
- [Roadmap](./ROADMAP.md) — was Version 1 enthält und was sie nicht vortäuscht.
- [Assistent und MCP](./MCP-ASSISTANT.md) — die Werkzeugschicht, das Chat-Panel und der MCP-Endpunkt.
- [iPhone-App](./IPHONE.md) — der native SwiftUI-Client, Bauen, Signieren und Installieren.

## Den Schreibtisch starten

```bash
bun install
bun run dev
```

Beim ersten Start wird `data/managr.db` angelegt und die Beispielgesellschaft Atelier Nordlicht UG geladen. Öffne [http://localhost:3000](http://localhost:3000).

Die Oberfläche ist standardmäßig auf Deutsch, Englisch ist die zweite Sprache. Diese Notizen gibt es auf Englisch und Deutsch; die Sprache lässt sich in der Navigationsleiste wechseln.

## iPhone-App

Ein nativer SwiftUI-Client liegt in `ios/`. Er liest dasselbe View-JSON und schreibt über `POST /api/tools`, das dasselbe Werkzeugregister und Journal wie MCP und der Assistent verwendet. Das Telefon spricht über das lokale WLAN mit dem Next.js-Server auf deinem Mac; der Mac behält die Datenbank. Bauen und installieren: [iPhone-App](./IPHONE.md).
