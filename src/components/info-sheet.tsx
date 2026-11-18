"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { guideById, guideSources, pick, type Guide, type GuideId } from "@/content/sources";
import { useI18n } from "./locale-provider";

type InfoContextValue = {
  topic: GuideId | null;
  open: (topic: GuideId, trigger?: HTMLElement | null) => void;
  close: () => void;
};

const InfoContext = createContext<InfoContextValue | null>(null);

/** Keeps the open explanation in the app shell so it can dock as a real column. */
export function InfoProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [topic, setTopic] = useState<GuideId | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setTopic(null);
  }, [pathname]);

  const value = useMemo<InfoContextValue>(
    () => ({
      topic,
      open: (next, trigger) => {
        triggerRef.current = trigger ?? null;
        setTopic(next);
      },
      close: () => {
        setTopic(null);
        triggerRef.current?.focus();
      },
    }),
    [topic],
  );

  return <InfoContext.Provider value={value}>{children}</InfoContext.Provider>;
}

export function useInfo(): InfoContextValue {
  const value = useContext(InfoContext);
  if (!value) throw new Error("InfoProvider is missing.");
  return value;
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.4v.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
    </svg>
  );
}

/** Opens the explanation in the docked info column. */
export function InfoButton({ topic }: { topic: GuideId }) {
  const { t, locale } = useI18n();
  const { topic: active, open } = useInfo();
  const guide = guideById.get(topic);
  if (!guide) return null;
  const label = t("info.open", { topic: pick(guide.title, locale) });
  return (
    <button
      type="button"
      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-pine transition hover:border-pine hover:bg-white aria-expanded:border-pine aria-expanded:bg-pine aria-expanded:text-paper"
      aria-label={label}
      title={label}
      aria-expanded={active === topic}
      onClick={(event) => open(topic, event.currentTarget)}
    >
      <InfoGlyph />
    </button>
  );
}

function GuideContent({ guide }: { guide: Guide }) {
  const { t, locale } = useI18n();
  return (
    <>
      <p className="text-sm leading-relaxed text-ink">{pick(guide.summary, locale)}</p>

      <div className="mt-5 grid gap-4">
        {guide.sections.map((section) => (
          <section key={section.heading.de} className="grid gap-1">
            <h3 className="text-base font-medium">{pick(section.heading, locale)}</h3>
            <p className="text-sm leading-relaxed text-muted">{pick(section.body, locale)}</p>
          </section>
        ))}
      </div>

      <div className="mt-6 border-t border-line pt-4">
        <h3 className="text-sm font-medium">{t("info.sources")}</h3>
        <ul className="mt-2 grid gap-2">
          {guideSources(guide).map((source) => (
            <li key={source.id}>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-line bg-white px-3 py-2 hover:border-ink"
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-pine">{pick(source.title, locale)}</span>
                  <span className="font-mono text-xs text-muted">{source.domain} ↗</span>
                </span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">
                  {pick(source.publisher, locale)} · {pick(source.kind, locale)}
                </span>
              </a>
            </li>
          ))}
        </ul>
        <Link href="/sources" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-pine">
          {t("info.registrar")}
        </Link>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">{t("info.note")}</p>
    </>
  );
}

/**
 * The explanation panel. `column` docks into the outermost right column of the
 * main layout on wide screens; `inline` shows the same content above the page
 * on smaller screens so it never covers the form.
 */
export function InfoPanel({ variant }: { variant: "column" | "inline" }) {
  const { t, locale } = useI18n();
  const { topic, close } = useInfo();
  const headingId = useId();
  const guide = topic ? guideById.get(topic) : null;
  if (!guide) return null;

  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">{t("info.eyebrow")}</p>
        <h2 id={headingId} className="mt-1 text-2xl leading-tight text-ink">{pick(guide.title, locale)}</h2>
      </div>
      <button
        type="button"
        aria-label={t("info.close")}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-card text-ink hover:border-ink"
        onClick={close}
      >
        <CloseGlyph />
      </button>
    </div>
  );

  if (variant === "column") {
    return (
      <aside
        id="info-panel-column"
        role="region"
        aria-labelledby={headingId}
        className="sticky top-0 hidden h-dvh w-[23rem] shrink-0 flex-col overflow-y-auto border-l border-line bg-card/70 px-5 py-6 xl:flex"
      >
        {header}
        <div className="mt-4">
          <GuideContent guide={guide} />
        </div>
      </aside>
    );
  }

  return (
    <aside
      id="info-panel-inline"
      role="region"
      aria-labelledby={headingId}
      className="mb-4 rounded-2xl border border-line bg-card p-4 xl:hidden"
    >
      {header}
      <div className="mt-4">
        <GuideContent guide={guide} />
      </div>
    </aside>
  );
}
