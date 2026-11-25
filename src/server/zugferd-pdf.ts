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
  mmToPt,
  unitSymbols,
  type ComfortProfile,
  type FacturXKitPDFTemplate,
  type SupportedLocales,
  type TableSchemeType,
} from "factur-x-kit";
import { PageSizes, rgb, type PDFDocument, type PDFFont } from "pdf-lib";

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

/**
 * Factur-X ships a two-page template that stops at the first page of line items.
 * This template paginates the table and repeats the summary only when it fits.
 */
export const zugferdPdfTemplate: FacturXKitPDFTemplate = async (data, pdfDoc, locale) => {
  const profile = data as ComfortProfile;
  const { regular, bold } = await embedFonts(pdfDoc);
  const scheme = tableScheme(profile, locale);
  const first = pdfDoc.addPage(PageSizes.A4);
  const pages = [first];

  await addSenderLineBlock(data, first, regular, locale);
  const yCustomer = await addCustomerAddressBlock(data, first, regular, locale);
  const yMeta = await addMetaBlock(data, first, regular, bold, locale);
  const yTitle = await addTitleBlock(data, first, bold, locale, {
    position: { y: Math.min(yCustomer - 50, yMeta - 20) },
  });
  const yIntro = await addIntroTextBlock(data, first, regular, locale, { position: { y: yTitle - 20 } });
  first.drawLine({
    start: { x: LEFT, y: yIntro - 15 },
    end: { x: first.getWidth() - RIGHT, y: yIntro - 15 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });

  let page = first;
  let y = yIntro - 15;
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
      page = pdfDoc.addPage(PageSizes.A4);
      pages.push(page);
      y = (dinA4Height - 25) * mmToPt;
    }
  }

  const summaryTop = y - 20;
  const measure = pdfDoc.addPage(PageSizes.A4);
  const summaryEnd = await addMonetarySummary(data, measure, regular, bold, locale, {
    position: { y: summaryTop },
  });
  const outroEnd = await addOutroTextBlock(data, measure, regular, bold, locale, {
    position: { y: summaryEnd - 30 },
  });
  pdfDoc.removePage(pdfDoc.getPageCount() - 1);

  if (outroEnd < BOTTOM) {
    page = pdfDoc.addPage(PageSizes.A4);
    pages.push(page);
    y = (dinA4Height - 30) * mmToPt;
  } else {
    y = summaryTop;
  }

  y = await addMonetarySummary(data, page, regular, bold, locale, { position: { y } });
  page.drawLine({
    start: { x: LEFT, y: y - 6 },
    end: { x: page.getWidth() - RIGHT, y: y - 6 },
    thickness: 0.5,
    color: rgb(0, 0, 0),
  });
  await addOutroTextBlock(data, page, regular, bold, locale, { position: { y: y - 30 } });

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
