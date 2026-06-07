import { useEffect, useRef, useState } from "react";

type Props = {
  value: string;
  onSave: (next: string) => Promise<void> | void;
  ariaLabel?: string;
  /** Değer boş olduğunda butonda gösterilecek metin. */
  placeholder?: string;
  /** Boş değer kaydedilebilir mi? Varsayılan: false (boş kayıt iptale eşit). */
  allowEmpty?: boolean;
  className?: string;
  inputClassName?: string;
  /** Boşken gösterilecek placeholder span'inin ek class'ı. */
  emptyClassName?: string;
};

/**
 * Sayfa başlığında ismi inline düzenleyen küçük editör.
 * - Tıklanınca input'a dönüşür, Enter ile kaydeder, Esc ile iptal eder.
 * - Boşken `placeholder` metni gösterilir.
 * - `allowEmpty` true ise input boş bırakılarak değer null/boş'a çekilebilir.
 */
export default function EditableTitle({
  value,
  onSave,
  ariaLabel = "Adı düzenle",
  placeholder,
  allowEmpty = false,
  className,
  inputClassName,
  emptyClassName,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  async function commit() {
    const next = draft.trim();
    if (next === value.trim()) {
      setDraft(value);
      setEditing(false);
      return;
    }
    if (!next && !allowEmpty) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={
          inputClassName ??
          "w-full rounded-lg border-2 border-zinc-300 bg-white px-2 py-1 text-lg font-semibold text-zinc-900 outline-none focus:border-zinc-900"
        }
      />
    );
  }

  const isEmpty = value.trim().length === 0;

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={ariaLabel}
      className={
        className ??
        "block w-full truncate rounded-md text-left text-lg font-semibold text-zinc-900 transition active:bg-zinc-100"
      }
      title="Düzenlemek için dokun"
    >
      {isEmpty ? (
        <span
          className={
            emptyClassName ?? "italic text-zinc-400"
          }
        >
          {placeholder ?? "Düzenle"}
        </span>
      ) : (
        value
      )}
    </button>
  );
}
