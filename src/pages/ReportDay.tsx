import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { supabase } from "../lib/supabase";
// exportReport is lazy-loaded to keep the initial bundle light

/* ─────────────────── types ─────────────────── */
export type TaskItem = { description: string; area: string };

/* ─────────────────── constants ─────────────────── */
const START_DATE = new Date(2026, 5, 4); // 4 Haziran 2026, local timezone
const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_WEEKDAYS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];
const WEATHER_OPTIONS = [
  "Güneşli", "Parçalı Bulutlu", "Çok Bulutlu", "Sisli",
  "Hafif Yağmurlu", "Aralıklı Yağmurlu", "Sağanak Yağışlı",
  "Hafif Kar Yağışlı", "Yoğun Kar Yağışlı", "Fırtınalı",
];

function emptyTask(): TaskItem { return { description: "", area: "" }; }
// Local-timezone-safe date → "YYYY-MM-DD"
function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()} ${TR_WEEKDAYS[d.getDay()]}`;
}

function prevDateStr(dateStr: string): string | null {
  const d = new Date(dateStr + "T00:00:00");
  const prev = new Date(d);
  prev.setDate(prev.getDate() - 1);
  const prevStr = toDateStr(prev);
  const startStr = toDateStr(START_DATE);
  if (prevStr < startStr) return null;
  return prevStr;
}

function todayStr(): string {
  const n = new Date();
  return toDateStr(new Date(n.getFullYear(), n.getMonth(), n.getDate()));
}

/* ─────────────────── task list editor ─────────────────── */
function TaskEditor({
  label,
  sublabel,
  tasks,
  onChange,
  readOnly = false,
  accent = "zinc",
}: {
  label: string;
  sublabel?: string;
  tasks: TaskItem[];
  onChange?: (t: TaskItem[]) => void;
  readOnly?: boolean;
  accent?: "zinc" | "blue" | "amber";
}) {
  const accentBg: Record<string, string> = {
    zinc: "bg-zinc-900",
    blue: "bg-blue-600",
    amber: "bg-amber-500",
  };
  const accentBorder: Record<string, string> = {
    zinc: "border-zinc-200",
    blue: "border-blue-100",
    amber: "border-amber-100",
  };

  function update(idx: number, field: keyof TaskItem, val: string) {
    if (!onChange) return;
    const next = tasks.map((t, i) => (i === idx ? { ...t, [field]: val } : t));
    onChange(next);
  }
  function remove(idx: number) {
    if (!onChange) return;
    onChange(tasks.filter((_, i) => i !== idx));
  }
  function add() {
    if (!onChange) return;
    onChange([...tasks, emptyTask()]);
  }

  return (
    <div className={`rounded-2xl border-2 ${accentBorder[accent]} bg-white overflow-hidden`}>
      <div className={`${accentBg[accent]} px-4 py-2.5`}>
        <p className="text-sm font-semibold text-white">{label}</p>
        {sublabel && <p className="text-xs text-white/70">{sublabel}</p>}
      </div>

      <div className="divide-y divide-zinc-100">
        {tasks.length === 0 && (
          <p className="px-4 py-4 text-sm text-zinc-400 text-center">
            {readOnly ? "—" : "Henüz iş eklenmedi"}
          </p>
        )}
        {tasks.map((t, idx) => (
          <div key={idx} className="flex items-start gap-2 px-3 py-2.5">
            <span className="mt-2.5 w-6 shrink-0 text-center text-xs font-bold text-zinc-400">
              {idx + 1}
            </span>
            {readOnly ? (
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-sm text-zinc-900 whitespace-pre-wrap">{t.description || "—"}</p>
                {t.area && (
                  <p className="text-xs text-zinc-500">Alan: {t.area}</p>
                )}
              </div>
            ) : (
              <>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <textarea
                    rows={2}
                    placeholder="İş açıklaması..."
                    value={t.description}
                    onChange={(e) => update(idx, "description", e.target.value)}
                    className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
                  />
                  <input
                    type="text"
                    placeholder="Alan / Bölge"
                    value={t.area}
                    onChange={(e) => update(idx, "area", e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="mt-2 shrink-0 rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500"
                  aria-label="Sil"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="border-t border-zinc-100 px-3 py-2">
          <button
            type="button"
            onClick={add}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            İş ekle
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────── main page ─────────────────── */
export default function ReportDayPage() {
  const { date: dateParam } = useParams<{ date: string }>();
  const navigate = useNavigate();

  const dateStr = dateParam ?? todayStr();
  const isToday = dateStr === todayStr();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const [reportNo, setReportNo] = useState<string>("");
  const [weather, setWeather] = useState("");
  const [temperature, setTemperature] = useState("");
  const [humidity, setHumidity] = useState("");
  const [wind, setWind] = useState("");
  const [prevTasks, setPrevTasks] = useState<TaskItem[]>([]);
  const [todayTasks, setTodayTasks] = useState<TaskItem[]>([emptyTask()]);
  const [tomorrowTasks, setTomorrowTasks] = useState<TaskItem[]>([emptyTask()]);
  const [importantNotes, setImportantNotes] = useState("");

  const prevDate = prevDateStr(dateStr);
  const dayOffset = daysBetween(START_DATE, new Date(dateStr + "T00:00:00"));
  const autoReportNo = dayOffset + 1;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSaved(false);

    async function load() {
      // Load this day's report
      const { data: thisDay } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("report_date", dateStr)
        .eq("visible", true)
        .maybeSingle();

      if (cancelled) return;

      if (thisDay) {
        setExistingId(thisDay.id);
        setReportNo(String(thisDay.report_no ?? autoReportNo));
        setWeather(thisDay.weather ?? "");
        setTemperature(thisDay.temperature ?? "");
        setHumidity(thisDay.humidity ?? "");
        setWind(thisDay.wind ?? "");
        const td = (thisDay.today_tasks ?? []) as TaskItem[];
        const tm = (thisDay.tomorrow_tasks ?? []) as TaskItem[];
        setTodayTasks(td.length ? td : [emptyTask()]);
        setTomorrowTasks(tm.length ? tm : [emptyTask()]);
        setImportantNotes(thisDay.important_notes ?? "");
        setSaved(true);
      } else {
        setExistingId(null);
        setReportNo(String(autoReportNo));
        setWeather("");
        setTemperature("");
        setHumidity("");
        setWind("");
        setTodayTasks([emptyTask()]);
        setTomorrowTasks([emptyTask()]);
        setImportantNotes("");
      }

      // Load previous day's today_tasks → becomes "önceki gün yapılan işler"
      if (prevDate) {
        const { data: prevDay } = await supabase
          .from("daily_reports")
          .select("today_tasks")
          .eq("report_date", prevDate)
          .eq("visible", true)
          .maybeSingle();
        if (!cancelled) {
          setPrevTasks(((prevDay?.today_tasks ?? []) as TaskItem[]).filter((t) => t.description.trim()));
        }
      } else {
        setPrevTasks([]);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [dateStr]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const payload = {
      report_date: dateStr,
      report_no: parseInt(reportNo) || autoReportNo,
      weather: weather || null,
      temperature: temperature || null,
      humidity: humidity || null,
      wind: wind || null,
      today_tasks: todayTasks.filter((t) => t.description.trim()),
      tomorrow_tasks: tomorrowTasks.filter((t) => t.description.trim()),
      important_notes: importantNotes.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (existingId) {
      const { error } = await supabase.from("daily_reports").update(payload).eq("id", existingId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("daily_reports").insert(payload).select("id").single();
      if (error) { setSaveError(error.message); setSaving(false); return; }
      if (data) setExistingId(data.id);
    }
    setSaved(true);
    setSaving(false);
  }, [dateStr, reportNo, weather, temperature, humidity, wind, todayTasks, tomorrowTasks, importantNotes, existingId, autoReportNo]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const { exportReportToExcel } = await import("../lib/exportReport");
      await exportReportToExcel(
        {
          report_date: dateStr,
          report_no: parseInt(reportNo) || autoReportNo,
          weather: weather || null,
          temperature: temperature || null,
          humidity: humidity || null,
          wind: wind || null,
          today_tasks: todayTasks.filter((t) => t.description.trim()),
          tomorrow_tasks: tomorrowTasks.filter((t) => t.description.trim()),
          important_notes: importantNotes.trim() || null,
        },
        prevTasks
      );
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setExporting(false);
    }
  }, [dateStr, reportNo, weather, temperature, humidity, wind, todayTasks, tomorrowTasks, importantNotes, prevTasks, autoReportNo]);

  const dateLabel = formatDateLabel(dateStr);
  const prevLabel = prevDate ? formatDateLabel(prevDate) : null;

  const navDate = (delta: number) => {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + delta);
    const next = toDateStr(d);
    if (next < toDateStr(START_DATE)) return;
    const t = todayStr();
    if (next > t) return;
    navigate(`/reports/${next}`);
  };

  if (loading) {
    return (
      <>
        <PageHeader title={dateLabel} back />
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-zinc-100" />
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <span>{dateLabel}</span>
            {isToday && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Bugün
              </span>
            )}
            {saved && (
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Kaydedildi
              </span>
            )}
          </div>
        }
        back
      />

      <div className="mx-auto max-w-2xl px-4 py-5 space-y-5">
        {/* Day navigation */}
        <div className="flex items-center justify-between rounded-2xl bg-zinc-50 px-4 py-2.5">
          <button
            onClick={() => navDate(-1)}
            disabled={dateStr <= toDateStr(START_DATE)}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Önceki gün
          </button>
          <span className="text-xs text-zinc-500 font-medium">{dateLabel}</span>
          <button
            onClick={() => navDate(1)}
            disabled={dateStr >= todayStr()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-30 transition"
          >
            Sonraki gün
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Header fields */}
        <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2.5">
            <p className="text-sm font-semibold text-white">Rapor Bilgileri</p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <FieldInput label="Rapor No" value={reportNo} onChange={setReportNo} type="number" />
            <FieldInput label="Tarih" value={dateLabel} onChange={() => {}} readOnly />
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase tracking-wide">Hava Durumu</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:bg-white focus:outline-none"
              >
                <option value="">Seçin…</option>
                {WEATHER_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
            <FieldInput label="Sıcaklık (°C)" value={temperature} onChange={setTemperature} placeholder="Örn: 28" />
            <FieldInput label="Nem (%)" value={humidity} onChange={setHumidity} placeholder="Örn: 55" />
            <FieldInput label="Rüzgar (km/s)" value={wind} onChange={setWind} placeholder="Örn: 20" />
          </div>
        </div>

        {/* Previous day tasks (read-only, auto-fill) */}
        <TaskEditor
          label="Önceki Gün Yapılan İşler"
          sublabel={prevLabel ? `${prevLabel} tarihli kayıttan otomatik doldu` : "Proje başlangıcı — önceki gün yok"}
          tasks={prevTasks}
          readOnly
          accent="zinc"
        />

        {/* Today's tasks */}
        <TaskEditor
          label="Rapor Günü Yapılacak İşler"
          sublabel={dateLabel}
          tasks={todayTasks}
          onChange={setTodayTasks}
          accent="blue"
        />

        {/* Tomorrow's tasks */}
        <TaskEditor
          label="Ertesi Gün İçin Planlanan İşler"
          tasks={tomorrowTasks}
          onChange={setTomorrowTasks}
          accent="amber"
        />

        {/* Important notes */}
        <div className="rounded-2xl border-2 border-zinc-200 bg-white overflow-hidden">
          <div className="bg-zinc-900 px-4 py-2.5">
            <p className="text-sm font-semibold text-white">
              Proje ile İlgili Önemli Hususlar
            </p>
            <p className="text-xs text-white/70">Gecikmeler, problemler, beklenmedik durumlar vs.</p>
          </div>
          <div className="p-4">
            <textarea
              rows={4}
              placeholder="Varsa önemli not, gecikme veya problem..."
              value={importantNotes}
              onChange={(e) => setImportantNotes(e.target.value)}
              className="w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 py-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 transition active:opacity-80"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Kaydediliyor…
              </>
            ) : saved ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Güncelle
              </>
            ) : (
              "Raporu Kaydet"
            )}
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            title="Excel formatında indir"
            className="flex items-center justify-center gap-2 rounded-2xl border-2 border-zinc-200 bg-white px-5 py-4 text-sm font-semibold text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 disabled:opacity-60 transition active:opacity-80"
          >
            {exporting ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <polyline points="8 17 12 21 16 17" />
                <line x1="12" y1="21" x2="12" y2="13" />
              </svg>
            )}
            <span className="hidden sm:inline">Excel İndir</span>
          </button>
        </div>

        {saveError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>Kayıt hatası:</strong> {saveError}
          </div>
        )}
        {exportError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <strong>İndirme hatası:</strong> {exportError}
          </div>
        )}

        <div className="pb-4" />
      </div>
    </>
  );
}

/* ─────────────────── field input helper ─────────────────── */
function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-zinc-500 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        className={`w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none ${
          readOnly ? "bg-zinc-100 text-zinc-500" : "bg-zinc-50 focus:bg-white"
        }`}
      />
    </div>
  );
}
