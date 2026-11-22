"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const frames = new WeakMap<HTMLElement, number>();

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function cancelFollow(el: HTMLElement): void {
  const frame = frames.get(el);
  if (frame !== undefined) cancelAnimationFrame(frame);
  frames.delete(el);
}

/** Eases a list toward its bottom, so streamed text slides instead of jumping. */
function followBottom(el: HTMLElement, keepGoing: () => boolean = () => true): void {
  cancelFollow(el);
  if (reducedMotion()) {
    el.scrollTop = el.scrollHeight;
    return;
  }
  const step = () => {
    if (!keepGoing()) {
      frames.delete(el);
      return;
    }
    const target = el.scrollHeight - el.clientHeight;
    const distance = target - el.scrollTop;
    if (distance <= 0.5) {
      el.scrollTop = target;
      frames.delete(el);
      return;
    }
    el.scrollTop += Math.max(1, distance * 0.18);
    frames.set(el, requestAnimationFrame(step));
  };
  frames.set(el, requestAnimationFrame(step));
}

/**
 * Keeps a transcript pinned to the bottom while it grows. A user who scrolls
 * up is left alone until they return to the bottom, and a freshly mounted list
 * jumps into place instead of animating through restored history.
 *
 * The hook returns a callback ref, because the panel mounts and unmounts its
 * list while the component itself stays alive.
 */
export function useFollowBottom<T extends HTMLElement>(deps: unknown[]): (node: T | null) => void {
  const [node, setNode] = useState<T | null>(null);
  const stick = useRef(true);
  const primed = useRef(false);
  const attach = useCallback((next: T | null) => setNode(next), []);

  useEffect(() => {
    primed.current = false;
    stick.current = true;
  }, [node]);

  useEffect(() => {
    if (!node) return;
    const el = node;
    const release = () => {
      stick.current = false;
      cancelFollow(el);
    };
    const onScroll = () => {
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance < 80) stick.current = true;
      else if (!frames.has(el)) stick.current = false;
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp" || event.key === "PageUp" || event.key === "Home") release();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", release, { passive: true });
    el.addEventListener("touchmove", release, { passive: true });
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", release);
      el.removeEventListener("touchmove", release);
      el.removeEventListener("keydown", onKey);
      cancelFollow(el);
    };
  }, [node]);

  useEffect(() => {
    if (!node) return;
    if (!primed.current) {
      primed.current = true;
      node.scrollTop = node.scrollHeight;
      return;
    }
    if (!stick.current) return;
    followBottom(node, () => stick.current);
    // The caller owns the dependencies that mean "new content arrived".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, ...deps]);

  return attach;
}