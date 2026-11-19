"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/locale-provider";
import { Field, TextInput } from "@/components/ui";

/**
 * IBAN, BIC, and bank name. When a complete German IBAN is entered, the BIC
 * and the bank name come from the local Bundesbank bank code table. A field
 * the user has typed into is left alone on later IBAN changes.
 */
export function BankDetailsFields({ iban, bic, bankName }: { iban: string; bic: string; bankName: string }) {
  const { t } = useI18n();
  const [ibanValue, setIbanValue] = useState(iban);
  const [bicValue, setBicValue] = useState(bic);
  const [bankNameValue, setBankNameValue] = useState(bankName);
  const lastIban = useRef(iban);
  const firstRun = useRef(true);
  const bicEdited = useRef(false);
  const nameEdited = useRef(false);

  useEffect(() => {
    const changed = ibanValue !== lastIban.current;
    if (!changed && !firstRun.current) return;
    const initial = firstRun.current;
    firstRun.current = false;
    lastIban.current = ibanValue;
    if (!ibanValue.trim()) return;
    void import("@/domain/bank-codes")
      .then(({ lookupGermanBank }) => {
        if (lastIban.current !== ibanValue) return;
        const bank = lookupGermanBank(ibanValue);
        if (!bank) return;
        if (initial) {
          // Keep anything already saved; fill the gaps on first render.
          if (!bic.trim()) setBicValue(bank.bic);
          if (!bankName.trim()) setBankNameValue(bank.name);
          return;
        }
        if (!bicEdited.current) setBicValue(bank.bic);
        if (!nameEdited.current) setBankNameValue(bank.name);
      })
      .catch(() => {
        // The fields stay editable when the local table is unavailable.
      });
  }, [ibanValue, bic, bankName]);

  return (
    <>
      <Field label="IBAN" hint={t("company.ibanHint")}>
        <TextInput
          name="iban"
          value={ibanValue}
          onChange={(event) => setIbanValue(event.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="DE00 0000 0000 0000 0000 00"
        />
      </Field>
      <Field label="BIC">
        <TextInput
          name="bic"
          value={bicValue}
          onChange={(event) => {
            bicEdited.current = true;
            setBicValue(event.target.value);
          }}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
        />
      </Field>
      <Field label={t("company.bankName")}>
        <TextInput
          name="bankName"
          value={bankNameValue}
          onChange={(event) => {
            nameEdited.current = true;
            setBankNameValue(event.target.value);
          }}
        />
      </Field>
    </>
  );
}