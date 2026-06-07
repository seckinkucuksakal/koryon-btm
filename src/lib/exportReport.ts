/**
 * Excel export utility – loads the official KORYON report template,
 * fills in the saved report data, and triggers a download.
 *
 * Template layout (sheet2):
 *  B6    – Rapor No
 *  O6    – Tarih  (dd.mm.yyyy string)
 *  O7    – Hava Durumu
 *  O8    – Sıcaklık
 *  O9    – Nem
 *  O10   – Rüzgar
 *  B13   – Rapor Günü Yapılan İşler – EKİP 1  (merged B13:E13)
 *  B14   – Rapor Günü Yapılan İşler – EKİP 2  (merged B14:E14)  ← bırakıyoruz boş
 *  K13   – Önceki Gün Yapılan İşler – EKİP1   (merged K13:N13)
 *  K14   – Önceki Gün Yapılan İşler – EKİP2   (merged K14:N14)  ← boş
 *  K17   – Ertesi Gün Planlanan İşler – EKİP 1 (merged K17:N17)
 *  K18   – Ertesi Gün Planlanan İşler – EKİP 2 (merged K18:N18) ← boş
 *  K23   – Önemli Hususlar – büyük alan (merged K23:N27)
 */

import ExcelJS from "exceljs";
import type { TaskItem } from "../pages/ReportDay";

export interface ReportExportData {
  report_date: string;
  report_no: number | null;
  weather: string | null;
  temperature: string | null;
  humidity: string | null;
  wind: string | null;
  today_tasks: TaskItem[];
  tomorrow_tasks: TaskItem[];
  important_notes: string | null;
}

/* ─── helpers ─── */

function formatDateTR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function formatTaskList(tasks: TaskItem[]): string {
  return tasks
    .filter((t) => t.description.trim())
    .map((t, i) => {
      const area = t.area?.trim() ? `  [${t.area.trim()}]` : "";
      return `${i + 1}. ${t.description.trim()}${area}`;
    })
    .join("\n");
}

function calcRowHeight(text: string, minHeight: number): number {
  const lines = text ? text.split("\n").length : 0;
  const needed = lines * 16 + 10;
  return Math.max(minHeight, needed);
}

function setCell(
  ws: ExcelJS.Worksheet,
  addr: string,
  value: string | number | null | undefined
): void {
  const cell = ws.getCell(addr);
  cell.value = value ?? "";
  // Enable text wrapping so newlines display correctly
  if (!cell.alignment) {
    cell.alignment = { wrapText: true, vertical: "top" };
  } else {
    cell.alignment = { ...cell.alignment, wrapText: true, vertical: "top" };
  }
}

function setRowHeight(ws: ExcelJS.Worksheet, rowNum: number, height: number): void {
  const row = ws.getRow(rowNum);
  row.height = height;
}

/* ─── main export ─── */

export async function exportReportToExcel(
  report: ReportExportData,
  prevTasks: TaskItem[]
): Promise<void> {
  // 1. Fetch the template bundled in /public/
  const res = await fetch("/report-template.xlsx");
  if (!res.ok) throw new Error("Şablon dosyası yüklenemedi (report-template.xlsx)");
  const buffer = await res.arrayBuffer();

  // 2. Load workbook
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  // 3. Use sheet2 (index 1) – first daily report sheet
  const ws = workbook.worksheets[1];
  if (!ws) throw new Error("Excel şablonunda çalışma sayfası bulunamadı.");

  // 4. Header fields
  setCell(ws, "B6", report.report_no ?? 1);
  setCell(ws, "O6", formatDateTR(report.report_date));
  setCell(ws, "O7", report.weather ?? "");
  setCell(ws, "O8", report.temperature ?? "");
  setCell(ws, "O9", report.humidity ?? "");
  setCell(ws, "O10", report.wind ?? "");

  // 5. Today's tasks → left side EKİP 1 (B13)
  const todayText = formatTaskList(report.today_tasks);
  setCell(ws, "B13", todayText);
  setRowHeight(ws, 13, calcRowHeight(todayText, 64.5));

  // 6. Previous day's tasks → right side EKİP1 (K13)
  const prevText = formatTaskList(prevTasks);
  setCell(ws, "K13", prevText);
  setRowHeight(ws, 13, calcRowHeight(prevText, 64.5));

  // 7. Tomorrow's tasks → right side EKİP 1 (K17)
  const tomorrowText = formatTaskList(report.tomorrow_tasks);
  setCell(ws, "K17", tomorrowText);
  setRowHeight(ws, 17, calcRowHeight(tomorrowText, 48));

  // 8. Important notes → K23 (large merged area K23:N27)
  const notes = report.important_notes ?? "";
  setCell(ws, "K23", notes);
  if (notes) {
    setRowHeight(ws, 23, calcRowHeight(notes, 37.5));
  }

  // 9. Clear broken #REF! formula cells that exist in the original template
  ws.getCell("H48").value = null;
  ws.getCell("I48").value = null;

  // 10. Convert MFiles DMS formula cells (O1-O4) to plain static values
  //     so the doc info section works without a DMS connection
  const mfilesCells: Record<string, string> = {
    O1: "TPR.PMM.FRM.0221",
    O2: "7.03.2022",
    O3: "2",
    O4: "6.01.2022",
  };
  for (const [addr, val] of Object.entries(mfilesCells)) {
    const cell = ws.getCell(addr);
    cell.value = val;
  }

  // 9. Rename the sheet to the report date
  ws.name = formatDateTR(report.report_date);

  // 10. Write to buffer and download
  const outBuffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([outBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Gunluk-Rapor-${report.report_date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
