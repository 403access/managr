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

## Den Schreibtisch starten

```bash
bun install
bun run dev
```

Beim ersten Start wird `data/managr.db` angelegt und die Beispielgesellschaft Atelier Nordlicht UG geladen. Öffne [http://localhost:3000](http://localhost:3000).

Die Oberfläche ist standardmäßig auf Deutsch, Englisch ist die zweite Sprache. Diese Notizen gibt es auf Englisch und Deutsch; die Sprache lässt sich in der Navigationsleiste wechseln.
