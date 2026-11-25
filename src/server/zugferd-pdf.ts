import "server-only";
import fs from "node:fs";
import path from "node:path";
import {
  addCustomerAddressBlock,
  addFooter,
  addIntroTextBlock,
  addMetaBlock,
  addMonetarySummary,
  addOutroTextBlock,
  addSenderLineBlock,
  addTitleBlock,
  dinA4Height,
  drawTable,
  getNumberOfLines,
  mmToPt,
  unitSymbols,
  type ComfortProfile,
  type FacturXKitPDFTemplate,
  type SupportedLocales,
  type TableSchemeType,
} from "factur-x-kit";
import { PageSizes, rgb, type PDFDocument, type PDFFont, type PDFPage } from "pdf-lib";
import { fillInvoiceLetter, type InvoiceLetter, type InvoiceLetterVariables } from "@/domain/invoice-letter";

type LineItem = ComfortProfile["invoiceLines"][number];

const LEFT = 25 * mmToPt;
const RIGHT = 20 * mmToPt;
const FOOTER_HEIGHT = 100;
const BOTTOM = FOOTER_HEIGHT + 12;

const labels = {
  "de-DE": {
    item: "Pos.",
    product: "Produkt",
    quantity: "Menge",
    unitPrice: "Einzelpreis",
    tax: "Steuer",
    total: "Gesamtpreis",
  },
  "en-US": {
    item: "Item",
    product: "Product",
    quantity: "Quantity",
    unitPrice: "Unit price",
    tax: "Tax",
    total: "Total",
  },
  "fr-FR": {
    item: "N°",
    product: "Produit",
    quantity: "Quantité",
    unitPrice: "Prix unitaire",
    tax: "TVA",
    total: "Total",
  },
} satisfies Record<SupportedLocales, Record<string, string>>;

const fontDirectory = path.join(process.cwd(), "node_modules", "@expo-google-fonts", "ibm-plex-sans");

let cachedFonts: { regular: Uint8Array; bold: Uint8Array } | null = null;

/** The fonts are embedded in full so the PDF/A-3 file carries its own glyphs. */
function fontBytes(): { regular: Uint8Array; bold: Uint8Array } {
  if (!cachedFonts) {
    cachedFonts = {
      regular: fs.readFileSync(path.join(fontDirectory, "400Regular", "IBMPlexSans_400Regular.ttf")),
      bold: fs.readFileSync(path.join(fontDirectory, "600SemiBold", "IBMPlexSans_600SemiBold.ttf")),
    };
  }
  return cachedFonts;
}

async function embedFonts(pdfDoc: PDFDocument): Promise<{ regular: PDFFont; bold: PDFFont }> {
  const bytes = fontBytes();
  return {
    regular: await pdfDoc.embedFont(bytes.regular, { subset: false }),
    bold: await pdfDoc.embedFont(bytes.bold, { subset: false }),
  };
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function tableScheme(profile: ComfortProfile, locale: SupportedLocales): TableSchemeType<LineItem>[] {
  const text = labels[locale];
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: profile.document.currency });
  const price = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: profile.document.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
  const quantity = new Intl.NumberFormat(locale, { style: "decimal", maximumFractionDigits: 4 });
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 2 });
  const hasTax = profile.invoiceLines.some((line) => line.settlement.tax.rateApplicablePercent !== undefined);
  const units = unitSymbols[locale] as Record<string, string | undefined>;

  return [
    {
      colAlignment: "left",
      colHeader: text.item,
      colWeight: 0.5,
      colContent: (line) => line.generalLineData.lineId,
    },
    {
      colAlignment: "left",
      colHeader: text.product,
      colWeight: 3,
      colContent: (line) => line.productDescription.name,
    },
    {
      colAlignment: "right",
      colHeader: text.quantity,
      colWeight: 1.5,
      colContent: (line) => {
        const unit = line.delivery.itemQuantity.unit;
        const symbol = unit ? units[unit] ?? "" : "";
        return `${quantity.format(round(line.delivery.itemQuantity.quantity, 4))}${symbol ? ` ${symbol}` : ""}`;
      },
    },
    {
      colAlignment: "right",
      colHeader: text.unitPrice,
      colWeight: 1.5,
      colContent: (line) => price.format(round(line.productPriceAgreement.productPricing?.basisPricePerItem ?? 0, 4)),
    },
    ...(hasTax
      ? [
          {
            colAlignment: "right" as const,
            colHeader: text.tax,
            colWeight: 1,
            colContent: (line: LineItem) => {
              const rate = line.settlement.tax.rateApplicablePercent;
              return rate === undefined ? "--" : percent.format(rate / 100);
            },
          },
        ]
      : []),
    {
      colAlignment: "right",
      colHeader: text.total,
      colWeight: 1.5,
      colContent: (line) => currency.format(round(line.settlement.lineTotals.netTotal, 2)),
    },
  ];
}

/** The letter fields are not part of EN 16931, so the template receives them alongside the profile. */
export type ZugferdLetter = {
  letter: InvoiceLetter;
  variables: InvoiceLetterVariables;
};

/**
 * Factur-X ships a two-page template that stops at the first page of line items.
 * This template paginates the table, repeats the summary only when it fits, and
 * keeps the invoice letter around the positions like the print view does.
 */
export function createZugferdPdfTemplate(letter: ZugferdLetter | null = null): FacturXKitPDFTemplate {
  return async (data, pdfDoc, locale) => {
    const profile = data as ComfortProfile;
    const { regular, bold } = await embedFonts(pdfDoc);
    const scheme = tableScheme(profile, locale);
    const first = pdfDoc.addPage(PageSizes.A4);
    const pages = [first];
    const textWidth = first.getWidth() - LEFT - RIGHT;
    const textColor = rgb(0, 0, 0);
    const fontSize = 10;
    const lineHeight = fontSize * 1.25;

    const addPage = (): PDFPage => {
      const next = pdfDoc.addPage(PageSizes.A4);
      pages.push(next);
      return next;
    };

    const drawTextBlock = (target: PDFPage, text: string, y: number, font: PDFFont, gapAfter = 0): number => {
      const value = text.trim();
      if (!value) return y;
      const lines = getNumberOfLines(value, fontSize, font, textWidth);
      target.drawText(value, {
        x: LEFT,
        y,
        font,
        size: fontSize,
        lineHeight,
        maxWidth: textWidth,
        color: textColor,
      });
      return y - lines * lineHeight - gapAfter;
    };

    await addSenderLineBlock(data, first, regular, locale);
    const yCustomer = await addCustomerAddressBlock(data, first, regular, locale);
    const yMeta = await addMetaBlock(data, first, regular, bold, locale);
    const yTitle = await addTitleBlock(data, first, bold, locale, {
      position: { y: Math.min(yCustomer - 50, yMeta - 20) },
    });

    let introPage = first;
    let introY = yTitle - 20;
    const drawIntro = (text: string, font: PDFFont, gapAfter: number) => {
      const value = text.trim();
      if (!value) return;
      const lines = getNumberOfLines(value, fontSize, font, textWidth);
      if (introY - lines * lineHeight < BOTTOM + 20) {
        introPage = addPage();
        introY = (dinA4Height - 25) * mmToPt;
      }
      introPage.drawText(value, {
        x: LEFT,
        y: introY,
        font,
        size: fontSize,
        lineHeight,
        maxWidth: textWidth,
        color: textColor,
      });
      introY = introY - lines * lineHeight - gapAfter;
    };

    if (letter) {
      if (letter.letter.subject.trim()) {
        drawIntro(`Betreff: ${letter.letter.subject.trim()}`, bold, 8);
      }
      drawIntro(letter.letter.salutation, regular, 8);
      drawIntro(fillInvoiceLetter(letter.letter.intro, letter.variables), regular, 0);
    }
    introY = await addIntroTextBlock(data, introPage, regular, locale, { position: { y: introY } });

    let page = introPage;
    let y = introY - 15;
    if (y < BOTTOM + 60) {
      page = addPage();
      y = (dinA4Height - 25) * mmToPt;
    } else {
      page.drawLine({
        start: { x: LEFT, y },
        end: { x: page.getWidth() - RIGHT, y },
        thickness: 0.5,
        color: textColor,
      });
    }

    let remaining = [...profile.invoiceLines];

    const endOfTable = async (rows: LineItem[], startY: number): Promise<number> => {
      const scratch = pdfDoc.addPage(PageSizes.A4);
      const [end] = await drawTable(scratch, rows, scheme, LEFT, startY, regular, bold);
      pdfDoc.removePage(pdfDoc.getPageCount() - 1);
      return end;
    };

    while (remaining.length > 0) {
      let count = remaining.length;
      if ((await endOfTable(remaining, y)) < BOTTOM) {
        let low = 1;
        let high = remaining.length - 1;
        count = 1;
        while (low <= high) {
          const middle = Math.floor((low + high) / 2);
          if ((await endOfTable(remaining.slice(0, middle), y)) >= BOTTOM) {
            count = middle;
            low = middle + 1;
          } else {
            high = middle - 1;
          }
        }
      }
      const chunk = remaining.slice(0, count);
      [y] = await drawTable(page, chunk, scheme, LEFT, y, regular, bold);
      remaining = remaining.slice(count);
      if (remaining.length > 0) {
        page = addPage();
        y = (dinA4Height - 25) * mmToPt;
      }
    }

    const drawLetterOutro = (target: PDFPage, startY: number): number => {
      if (!letter) return startY;
      let current = startY;
      current = drawTextBlock(target, fillInvoiceLetter(letter.letter.payment, letter.variables), current, regular, 18);
      current = drawTextBlock(target, fillInvoiceLetter(letter.letter.closing, letter.variables), current, regular, 18);
      current = drawTextBlock(target, fillInvoiceLetter(letter.letter.signature, letter.variables), current, regular, 14);
      const person = "tradeContact" in profile.seller ? profile.seller.tradeContact?.[0]?.personName ?? "" : "";
      return drawTextBlock(target, person, current, bold);
    };

    const summaryTop = y - 20;
    const measure = pdfDoc.addPage(PageSizes.A4);
    const summaryEnd = await addMonetarySummary(data, measure, regular, bold, locale, {
      position: { y: summaryTop },
    });
    const outroEnd = await addOutroTextBlock(data, measure, regular, bold, locale, {
      position: { y: summaryEnd - 30 },
    });
    const letterOutroEnd = drawLetterOutro(measure, outroEnd - 24);
    pdfDoc.removePage(pdfDoc.getPageCount() - 1);

    if (letterOutroEnd < BOTTOM) {
      page = addPage();
      y = (dinA4Height - 30) * mmToPt;
    } else {
      y = summaryTop;
    }

    y = await addMonetarySummary(data, page, regular, bold, locale, { position: { y } });
    page.drawLine({
      start: { x: LEFT, y: y - 6 },
      end: { x: page.getWidth() - RIGHT, y: y - 6 },
      thickness: 0.5,
      color: textColor,
    });
    const renderedOutroEnd = await addOutroTextBlock(data, page, regular, bold, locale, { position: { y: y - 30 } });
    drawLetterOutro(page, renderedOutroEnd - 24);

    for (const [index, item] of pages.entries()) {
      await addFooter(data, item, regular, locale, {
        position: { x: 15 * mmToPt, y: FOOTER_HEIGHT },
        fontSize: 8,
        color: rgb(0, 0, 0),
      });
      if (pages.length > 1) {
        const label = locale === "de-DE" ? `Seite ${index + 1} von ${pages.length}` : `Page ${index + 1} of ${pages.length}`;
        const width = regular.widthOfTextAtSize(label, 8);
        item.drawText(label, {
          x: item.getWidth() - 15 * mmToPt - width,
          y: 70,
          font: regular,
          size: 8,
          color: rgb(0.35, 0.35, 0.35),
        });
      }
    }

    return pdfDoc;
  };
}
