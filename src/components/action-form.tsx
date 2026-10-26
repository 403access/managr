"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { initialState, type ActionState } from "@/server/form";
import { useI18n } from "./locale-provider";
import { buttonClass, type ButtonTone } from "./ui";

export function ActionForm({
  action,
  children,
  confirm,
  compact = false,
  className,
  resetOnSuccess = false,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  confirm?: string;
  compact?: boolean;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { tx } = useI18n();
  const [state, formAction] = useActionState(action, initialState);
  const queryClient = useQueryClient();
  const seen = useRef(state);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (seen.current === state) return;
    seen.current = state;
    if (!state.message) return;
    if (resetOnSuccess) formRef.current?.reset();
    void queryClient.invalidateQueries({ queryKey: ["view"] });
  }, [queryClient, resetOnSuccess, state]);
  return (
    <form
      ref={formRef}
      action={formAction}
      className={className ?? (compact ? "flex flex-wrap items-center gap-2" : "grid gap-4")}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {children}
      {state.error ? (
        <p className="basis-full text-sm text-clay" role="alert">
          {tx(state.error)}
        </p>
      ) : null}
      {state.message ? (
        <p className="basis-full text-sm text-moss" role="status">
          {tx(state.message)}
        </p>
      ) : null}
    </form>
  );
}

export function SubmitButton({ children, tone = "primary", name, value }: { children: ReactNode; tone?: ButtonTone; name?: string; value?: string }) {
  const { pending } = useFormStatus();
  const { t } = useI18n();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={buttonClass(tone)}>
      {pending ? t("common.saving") : children}
    </button>
  );
}
