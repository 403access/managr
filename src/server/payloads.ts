import { z } from "zod";

export const invoiceLetterSchema = z.object({
  subject: z.string().trim().max(200).default(""),
  salutation: z.string().trim().max(300).default(""),
  intro: z.string().trim().max(2000).default(""),
  payment: z.string().trim().max(1000).default(""),
  closing: z.string().trim().max(1000).default(""),
  signature: z.string().trim().max(300).default(""),
});

export const invoicePayloadSchema = z.object({
  invoiceId: z.number().int().positive().nullable(),
  customerMode: z.enum(["existing", "new"]),
  customerId: z.number().int().positive().nullable(),
  newCustomer: z.object({
    name: z.string().trim().max(160),
    street: z.string().trim().max(160),
    postalCode: z.string().trim().max(16),
    city: z.string().trim().max(80),
    country: z.string().trim().max(80),
    email: z.string().trim().max(160),
    vatId: z.string().trim().max(32),
  }),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(2000),
  buyerReference: z.string().trim().max(100).default(""),
  amountDisplay: z.enum(["net", "gross"]).default("net"),
  lineGrouping: z.enum(["none", "date"]).nullable().default(null),
  letter: invoiceLetterSchema.optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().max(400),
        quantity: z.string().trim().max(20),
        unitNet: z.string().trim().max(20),
        vatBps: z.number().int(),
        timeEntryId: z.number().int().positive().nullable().default(null),
        timeActivityId: z.number().int().positive().nullable().default(null),
      }),
    )
    .min(1)
    .max(200),
});

export const journalPayloadSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().trim().min(1).max(200),
  lines: z
    .array(
      z.object({
        accountCode: z.string().trim().max(8),
        debit: z.string().max(20),
        credit: z.string().max(20),
      }),
    )
    .min(2)
    .max(12),
});

export type InvoicePayload = z.infer<typeof invoicePayloadSchema>;
export type JournalPayload = z.infer<typeof journalPayloadSchema>;
