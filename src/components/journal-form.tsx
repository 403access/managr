"use client";

import { useState } from "react";
import { saveJournal } from "@/server/actions";
import { journalImbalance, type DraftLine } from "@/domain/accounts";
import { parseEuroToCents } from "@/domain/money";
import { ActionForm, SubmitButton } from "./action-form";
import { buttonClass, Field, inputClass } from "./ui";

type AccountOption = { code: string; name: string };
type Line = { accountCode: string; debit: string; credit: string };

function cents(raw: string): number | null {
  if (!raw.trim()) return 0;
  return parseEuroToCents(raw);
}

export function JournalForm({ today, accounts }: { today: string; accounts: AccountOption[] }) {
  const first = accounts[0]?.code ?? "";
  const [date, setDate] = useState(today);
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { accountCode: accounts.find((account) => account.code === "1200")?.code ?? first, debit: "", credit: "" },
    { accountCode: accounts.find((account) => account.code === "4900")?.code ?? first, debit: "", credit: "" },
  ]);

  const draft: DraftLine[] = [];
  let amountsOk = true;
  for (const line of lines) {
    const debitCents = cents(line.debit);
    const creditCents = cents(line.credit);
    if (debitCents === null || creditCents === null) amountsOk = false;
    else if (debitCents > 0 || creditCents > 0) draft.push({ accountCode: line.accountCode, debitCents, creditCents });
  }
  const problem = !amountsOk ? "Check the amounts." : draft.length < 2 ? "Add at least two amounts." : journalImbalance(draft);

  const payload = JSON.stringify({ date, memo, lines });

  return (
    <ActionForm action={saveJournal}>
      <input type="hidden" name="payload" value={payload} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Date"><input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
        <Field label="Memo"><input className={inputClass} value={memo} onChange={(event) => setMemo(event.target.value)} /></Field>
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Account</span>
            <select className={inputClass} value={line.accountCode} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, accountCode: event.target.value } : item))}>
              {accounts.map((account) => <option key={account.code} value={account.code}>{account.code} {account.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Debit</span>
            <input className={inputClass} inputMode="decimal" value={line.debit} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, debit: event.target.value } : item))} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Credit</span>
            <input className={inputClass} inputMode="decimal" value={line.credit} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, credit: event.target.value } : item))} />
          </label>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {lines.length < 8 ? (
          <button type="button" className={buttonClass("quiet")} onClick={() => setLines((current) => [...current, { accountCode: first, debit: "", credit: "" }])}>Add line</button>
        ) : null}
        {lines.length > 2 ? (
          <button type="button" className={buttonClass("quiet")} onClick={() => setLines((current) => current.slice(0, -1))}>Remove last line</button>
        ) : null}
      </div>
      {problem ? <p className="text-sm text-muted">{problem}</p> : <p className="text-sm text-moss">The entry balances.</p>}
      <SubmitButton>Post entry</SubmitButton>
    </ActionForm>
  );
}
