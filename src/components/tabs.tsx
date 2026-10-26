"use client";

import { Children, createContext, isValidElement, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

type TabProps = { id: string; label: string; children: ReactNode };

type TabsContextValue = { active: string; uid: string };

const TabsContext = createContext<TabsContextValue | null>(null);

function tabItems(children: ReactNode): TabProps[] {
  const items: TabProps[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement<TabProps>(child)) return;
    items.push({ id: child.props.id, label: child.props.label, children: child.props.children });
  });
  return items;
}

export function Tabs({ label, children }: { label: string; children: ReactNode }) {
  const items = tabItems(children);
  const signature = items.map((item) => item.id).join("|");
  const [selected, setSelected] = useState<string | null>(null);
  const active = items.some((item) => item.id === selected) ? (selected ?? "") : (items[0]?.id ?? "");
  const uid = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = signature.split("|").filter(Boolean);
    const apply = () => {
      const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (!ids.includes(hash)) return;
      setSelected(hash);
      document.getElementById(`${uid}-${hash}-tab`)?.scrollIntoView({ inline: "nearest", block: "nearest" });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, [signature, uid]);

  function select(id: string) {
    setSelected(id);
    const next = `${window.location.pathname}${window.location.search}#${id}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (current !== next) {
      // Keep Next's history state. A bare replaceState makes the app router
      // restore the route and drop the hash.
      const state = window.history.state;
      const data = state && typeof state === "object" ? { ...state } : state;
      history.replaceState(data, "", next);
    }
    const root = rootRef.current;
    if (!root) return;
    if (window.scrollY > root.offsetTop) window.scrollTo({ top: root.offsetTop, behavior: "auto" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const ids = items.map((item) => item.id);
    const index = Math.max(0, ids.indexOf(active));
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % ids.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + ids.length) % ids.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = ids.length - 1;
    else return;
    event.preventDefault();
    const id = ids[next];
    if (!id) return;
    select(id);
    document.getElementById(`${uid}-${id}-tab`)?.focus();
  }

  return (
    <div ref={rootRef}>
      <div className="sticky top-0 z-20 -mx-4 bg-paper/95 px-4 pt-2 pb-4 backdrop-blur md:-mx-8 md:px-8">
        <div role="tablist" aria-label={label} aria-orientation="horizontal" onKeyDown={onKeyDown} className="flex gap-2 overflow-x-auto">
          {items.map((item) => {
            const on = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${uid}-${item.id}-tab`}
                aria-selected={on}
                aria-controls={`${uid}-${item.id}-panel`}
                tabIndex={on ? 0 : -1}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap ${on ? "bg-pine text-paper" : "border border-line bg-card text-ink"}`}
                onClick={() => select(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <TabsContext.Provider value={{ active, uid }}>{children}</TabsContext.Provider>
    </div>
  );
}

export function Tab({ id, label, children }: TabProps) {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    return (
      <section>
        <h2 className="mb-3 text-2xl">{label}</h2>
        {children}
      </section>
    );
  }
  const selected = ctx.active === id;
  return (
    <section role="tabpanel" id={`${ctx.uid}-${id}-panel`} aria-labelledby={`${ctx.uid}-${id}-tab`} hidden={!selected} className="section-panel min-w-0">
      {children}
    </section>
  );
}
