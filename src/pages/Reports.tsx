import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";

const START_DATE = new Date(2026, 5, 4); // 4 Haziran 2026, local timezone

// Local-timezone-safe date → "YYYY-MM-DD"
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function todayLocal(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function buildDayRange(): Date[] {
  const today = todayLocal();
  const days: Date[] = [];
  let cur = new Date(START_DATE);
  while (cur <= today) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

type ReportMeta = {
  report_date: string;
  report_no: number | null;
};

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_WEEKDAYS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

export default function ReportsPage() {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reportMeta, setReportMeta] = useState<Map<string, ReportMeta>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("daily_reports")
      .select("report_date, report_no")
      .eq("visible", true)
      .then(({ data }) => {
        const set = new Set<string>();
        const map = new Map<string, ReportMeta>();
        for (const r of data ?? []) {
          set.add(r.report_date);
          map.set(r.report_date, r as ReportMeta);
        }
        setSaved(set);
        setReportMeta(map);
        setLoading(false);
      });
  }, []);

  const days = buildDayRange();
  const todayStr = toDateStr(todayLocal());

  // Group by year-month
  const byMonth = new Map<string, Date[]>();
  for (const d of days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(d);
  }

  return (
    <>
      <PageHeader title="Günlük Faaliyet Raporları" back />
      <div className="mx-auto max-w-2xl px-4 py-5 space-y-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-100" />
            ))}
          </div>
        ) : (
          Array.from(byMonth.entries()).reverse().map(([key, monthDays]) => {
            const sample = monthDays[0];
            const monthLabel = `${TR_MONTHS[sample.getMonth()]} ${sample.getFullYear()}`;
            const savedCount = monthDays.filter((d) => saved.has(toDateStr(d))).length;

            return (
              <section key={key}>
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-base font-semibold text-zinc-900">{monthLabel}</h2>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">
                    {savedCount}/{monthDays.length} rapor
                  </span>
                </div>
                <ul className="space-y-2">
                  {[...monthDays].reverse().map((d) => {
                    const ds = toDateStr(d);
                    const isToday = ds === todayStr;
                    const hasSaved = saved.has(ds);
                    const meta = reportMeta.get(ds);
                    const dayNum = d.getDate();
                    const weekday = TR_WEEKDAYS[d.getDay()];
                    const monthShort = TR_MONTHS[d.getMonth()].slice(0, 3);

                    return (
                      <li key={ds}>
                        <Link
                          to={`/reports/${ds}`}
                          className={`flex items-center gap-3 rounded-2xl border-2 px-4 py-3 transition active:opacity-80 ${
                            isToday
                              ? "border-zinc-900 bg-zinc-900 text-white"
                              : hasSaved
                              ? "border-zinc-200 bg-white text-zinc-900 md:hover:border-zinc-300"
                              : "border-dashed border-zinc-200 bg-white text-zinc-500 md:hover:border-zinc-400"
                          }`}
                        >
                          <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${
                            isToday ? "bg-white/15" : hasSaved ? "bg-zinc-50" : "bg-zinc-50"
                          }`}>
                            <span className={`text-xl font-bold leading-none ${isToday ? "text-white" : "text-zinc-900"}`}>
                              {dayNum}
                            </span>
                            <span className={`text-[10px] font-medium uppercase ${isToday ? "text-white/70" : "text-zinc-400"}`}>
                              {weekday}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {dayNum} {monthShort}
                              </span>
                              {isToday && (
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                  Bugün
                                </span>
                              )}
                              {meta?.report_no && (
                                <span className={`text-xs ${isToday ? "text-white/60" : "text-zinc-400"}`}>
                                  Rapor #{meta.report_no}
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${isToday ? "text-white/70" : hasSaved ? "text-zinc-500" : "text-zinc-400"}`}>
                              {hasSaved ? "Rapor kaydedildi" : "Henüz rapor girilmedi"}
                            </div>
                          </div>

                          <StatusDot saved={hasSaved} today={isToday} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })
        )}

        <div className="pb-4 text-center text-xs text-zinc-400">
          Proje başlangıç: 4 Haziran 2026
        </div>
      </div>
    </>
  );
}

function StatusDot({ saved, today }: { saved: boolean; today: boolean }) {
  if (today) {
    return (
      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-white" />
    );
  }
  if (saved) {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-emerald-500">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <div className="h-2.5 w-2.5 shrink-0 rounded-full border-2 border-zinc-300" />
  );
}
