import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { useConfirm } from "../components/ConfirmDialog";
import {
  addExtraReportDay,
  buildReportDays,
  getExtraReportDays,
  isManualExtraDay,
  removeExtraReportDay,
  toDateStr,
  todayLocal,
  validateNewReportDay,
  isWeekend,
} from "../lib/reportDates";
import { supabase } from "../lib/supabase";

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
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reportMeta, setReportMeta] = useState<Map<string, ReportMeta>>(new Map());
  const [extraDays, setExtraDays] = useState<string[]>(() => getExtraReportDays());
  const [loading, setLoading] = useState(true);
  const [showAddDay, setShowAddDay] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

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

  const savedDates = useMemo(() => Array.from(saved), [saved]);
  const days = useMemo(
    () => buildReportDays(extraDays, savedDates),
    [extraDays, savedDates],
  );
  const dayStrSet = useMemo(() => new Set(days.map(toDateStr)), [days]);
  const todayStr = toDateStr(todayLocal());

  const handleAddDay = () => {
    setAddError(null);
    const err = validateNewReportDay(newDate, dayStrSet);
    if (err) {
      setAddError(err);
      return;
    }
    addExtraReportDay(newDate);
    setExtraDays(getExtraReportDays());
    setShowAddDay(false);
    setNewDate("");
    navigate(`/reports/${newDate}`);
  };

  const formatDayLabel = (ds: string) => {
    const d = new Date(`${ds}T00:00:00`);
    return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  };

  const handleRemoveDay = async (ds: string, hasSaved: boolean) => {
    const label = formatDayLabel(ds);
    const ok = await confirm({
      title: "Ek günü kaldır",
      message: hasSaved
        ? `${label} tarihli mesai günü listeden kaldırılacak ve kayıtlı rapor silinecek.`
        : `${label} tarihli mesai günü listeden kaldırılacak.`,
      confirmText: "Kaldır",
      destructive: true,
    });
    if (!ok) return;

    removeExtraReportDay(ds);
    setExtraDays(getExtraReportDays());

    if (hasSaved) {
      const { error } = await supabase
        .from("daily_reports")
        .update({ visible: false, deleted_at: new Date().toISOString() })
        .eq("report_date", ds);
      if (error) return;
      setSaved((prev) => {
        const next = new Set(prev);
        next.delete(ds);
        return next;
      });
      setReportMeta((prev) => {
        const next = new Map(prev);
        next.delete(ds);
        return next;
      });
    }
  };

  // Group by year-month
  const byMonth = new Map<string, typeof days>();
  for (const d of days) {
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(d);
  }

  return (
    <>
      <PageHeader title="Günlük Faaliyet Raporları" back />
      <div className="mx-auto max-w-2xl px-4 py-5 space-y-6">
        {!loading && (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-4">
            {!showAddDay ? (
              <button
                type="button"
                onClick={() => {
                  setShowAddDay(true);
                  setAddError(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-zinc-700 hover:bg-white transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Mesai / ek gün ekle
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-zinc-700">
                  Hafta sonu veya listede olmayan bir gün için rapor ekleyin
                </p>
                <input
                  type="date"
                  value={newDate}
                  min={toDateStr(new Date(2026, 5, 4))}
                  max={todayStr}
                  onChange={(e) => {
                    setNewDate(e.target.value);
                    setAddError(null);
                  }}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                />
                {addError && (
                  <p className="text-sm text-red-600">{addError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddDay}
                    disabled={!newDate}
                    className="flex-1 rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40 transition"
                  >
                    Ekle ve rapora git
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddDay(false);
                      setNewDate("");
                      setAddError(null);
                    }}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition"
                  >
                    İptal
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                    const isExtra = isWeekend(d) || extraDays.includes(ds);
                    const canRemove = isManualExtraDay(ds, extraDays);

                    return (
                      <li key={ds} className="flex items-stretch gap-2">
                        <Link
                          to={`/reports/${ds}`}
                          className={`flex min-w-0 flex-1 items-center gap-3 rounded-2xl border-2 px-4 py-3 transition active:opacity-80 ${
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">
                                {dayNum} {monthShort}
                              </span>
                              {isToday && (
                                <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                                  Bugün
                                </span>
                              )}
                              {isExtra && (
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                                  isToday ? "bg-white/20 text-white" : "bg-amber-50 text-amber-700"
                                }`}>
                                  Mesai
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
                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDay(ds, hasSaved)}
                            aria-label={`${formatDayLabel(ds)} gününü kaldır`}
                            className="flex shrink-0 items-center justify-center rounded-2xl border-2 border-zinc-200 bg-white px-3 text-zinc-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        )}
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
