export const START_DATE = new Date(2026, 5, 4); // 4 Haziran 2026, local timezone

const EXTRA_DAYS_STORAGE_KEY = "koryon-extra-report-days";

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function isWeekend(d: Date): boolean {
  const w = d.getDay();
  return w === 0 || w === 6;
}

export function getExtraReportDays(): string[] {
  try {
    const raw = localStorage.getItem(EXTRA_DAYS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((d): d is string => typeof d === "string")
      : [];
  } catch {
    return [];
  }
}

export function addExtraReportDay(dateStr: string): void {
  const existing = getExtraReportDays();
  if (existing.includes(dateStr)) return;
  localStorage.setItem(
    EXTRA_DAYS_STORAGE_KEY,
    JSON.stringify([...existing, dateStr].sort()),
  );
}

export function removeExtraReportDay(dateStr: string): void {
  const next = getExtraReportDays().filter((d) => d !== dateStr);
  localStorage.setItem(EXTRA_DAYS_STORAGE_KEY, JSON.stringify(next));
}

/** Manuel eklenen mesai günü mü (standart iş günü değil). */
export function isManualExtraDay(dateStr: string, extraDays: string[]): boolean {
  return extraDays.includes(dateStr);
}

/** Standart iş günleri (hafta sonu hariç), proje başlangıcından bugüne. */
export function buildStandardWorkdays(): Date[] {
  const today = todayLocal();
  const days: Date[] = [];
  let cur = new Date(START_DATE);
  while (cur <= today) {
    if (!isWeekend(cur)) days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

/** İş günleri + eklenen mesai günleri + kayıtlı rapor tarihleri. */
export function buildReportDays(extraDays: string[], savedDates: string[]): Date[] {
  const startStr = toDateStr(START_DATE);
  const endStr = toDateStr(todayLocal());
  const map = new Map<string, Date>();

  for (const d of buildStandardWorkdays()) {
    map.set(toDateStr(d), d);
  }
  for (const ds of [...extraDays, ...savedDates]) {
    if (ds >= startStr && ds <= endStr) {
      map.set(ds, new Date(`${ds}T00:00:00`));
    }
  }

  return Array.from(map.values()).sort((a, b) => a.getTime() - b.getTime());
}

export function isAllowedReportDay(
  dateStr: string,
  extraDays: string[],
  hasSavedReport: boolean,
): boolean {
  if (dateStr < toDateStr(START_DATE) || dateStr > toDateStr(todayLocal())) {
    return false;
  }
  const d = new Date(`${dateStr}T00:00:00`);
  if (!isWeekend(d)) return true;
  return extraDays.includes(dateStr) || hasSavedReport;
}

export function adjacentReportDay(
  dateStr: string,
  delta: -1 | 1,
  allDays: Date[],
): string | null {
  const sorted = allDays.map(toDateStr);
  const idx = sorted.indexOf(dateStr);
  if (idx === -1) return null;
  const next = idx + delta;
  if (next < 0 || next >= sorted.length) return null;
  return sorted[next];
}

export function validateNewReportDay(
  dateStr: string,
  existingDayStrs: Set<string>,
): string | null {
  if (dateStr < toDateStr(START_DATE)) return "Proje başlangıcından (4 Haziran 2026) önce olamaz.";
  if (dateStr > toDateStr(todayLocal())) return "Gelecek bir tarih eklenemez.";
  if (existingDayStrs.has(dateStr)) return "Bu gün zaten listede.";
  return null;
}

/** Önceki iş gününü döndürür (Cumartesi/Pazar atlanır). */
export function prevWorkdayStr(dateStr: string): string | null {
  const d = new Date(`${dateStr}T00:00:00`);
  const prev = new Date(d);
  const startStr = toDateStr(START_DATE);
  do {
    prev.setDate(prev.getDate() - 1);
    if (toDateStr(prev) < startStr) return null;
  } while (isWeekend(prev));
  return toDateStr(prev);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
