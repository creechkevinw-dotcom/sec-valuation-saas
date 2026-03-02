import type { ValuationReport } from "@/types/valuation";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function generateReportPdf(report: ValuationReport): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const draw = (text: string, x: number, y: number, size = 11, isBold = false) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.12, 0.12, 0.12),
    });
  };

  draw(`${report.companyName} (${report.ticker})`, 50, 740, 20, true);
  draw(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 50, 718);
  draw(`Financial Health Score: ${report.healthScore}/100`, 50, 694, 13, true);

  draw("DCF Summary", 50, 664, 14, true);
  draw(`Mid Fair Value/Share: $${report.dcf.base.fairValuePerShare.toFixed(2)}`, 50, 642);
  draw(`High Fair Value/Share: $${report.dcf.bull.fairValuePerShare.toFixed(2)}`, 50, 626);
  draw(`Low Fair Value/Share: $${report.dcf.bear.fairValuePerShare.toFixed(2)}`, 50, 610);

  draw("5Y Financial History", 50, 578, 14, true);
  let cursor = 558;
  for (const row of report.history) {
    draw(
      `${row.year}: Revenue $${(row.revenue / 1_000_000_000).toFixed(2)}B | FCF $${(row.fcf / 1_000_000_000).toFixed(2)}B`,
      50,
      cursor,
      10,
    );
    cursor -= 16;
  }

  draw("Projection", 50, cursor - 8, 14, true);
  cursor -= 28;
  for (const row of report.projections) {
    draw(
      `${row.year}: Revenue $${(row.revenue / 1_000_000_000).toFixed(2)}B | FCF $${(row.fcf / 1_000_000_000).toFixed(2)}B`,
      50,
      cursor,
      10,
    );
    cursor -= 16;
  }

  cursor -= 8;
  draw("Enrichment Metrics", 50, cursor, 14, true);
  cursor -= 18;
  draw(`Current Ratio: ${report.enrichment.liquidity.currentRatio.toFixed(2)}`, 50, cursor, 10);
  cursor -= 14;
  draw(`Quick Ratio: ${report.enrichment.liquidity.quickRatio.toFixed(2)}`, 50, cursor, 10);
  cursor -= 14;
  draw(`Interest Coverage: ${report.enrichment.liquidity.interestCoverage.toFixed(2)}`, 50, cursor, 10);
  cursor -= 14;
  draw(`Capex/Revenue: ${(report.enrichment.intensity.capexToRevenue * 100).toFixed(2)}%`, 50, cursor, 10);
  cursor -= 14;
  draw(`R&D/Revenue: ${(report.enrichment.intensity.rAndDToRevenue * 100).toFixed(2)}%`, 50, cursor, 10);
  cursor -= 14;
  draw(`SBC/Revenue: ${(report.enrichment.intensity.sbcToRevenue * 100).toFixed(2)}%`, 50, cursor, 10);

  return pdf.save();
}
