import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { TextArea, TextField } from "../components/Form";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";
import type { Database } from "../lib/database.types";

type Unit = Database["public"]["Tables"]["units"]["Row"];

export default function NewRoomPage() {
  const { id: unitId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!unitId) return;
    let cancelled = false;
    supabase
      .from("units")
      .select("*")
      .eq("id", unitId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setUnit(data ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [unitId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitId || !roomName.trim()) return;
    setBusy(true);
    setError(null);

    const { data, error: dbErr } = await supabase
      .from("rooms")
      .insert({
        unit_id: unitId,
        room_name: roomName.trim(),
        description: description.trim() || null,
      })
      .select("id")
      .single();

    setBusy(false);

    if (dbErr || !data) {
      setError(dbErr?.message ?? "Kaydedilemedi");
      return;
    }

    navigate(`/rooms/${data.id}`, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Yeni Oda"
        subtitle={unit ? unit.name : undefined}
        back
      />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-xl space-y-4 px-4 py-6"
      >
        <TextField
          label="Oda Adı"
          required
          autoFocus
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Ör. Pano Odası A, MCC Odası"
          autoCapitalize="words"
          autoComplete="off"
        />
        <TextArea
          label="Açıklama"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="İsteğe bağlı kısa not"
        />

        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <BigButton
          type="submit"
          variant="primary"
          label={busy ? "Kaydediliyor..." : "Kaydet"}
          disabled={busy || !roomName.trim()}
        />
      </form>
    </>
  );
}
