import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { TextArea, TextField } from "../components/Form";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";

export default function NewRoomPage() {
  const navigate = useNavigate();
  const [unitName, setUnitName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitName.trim() || !roomName.trim()) return;
    setBusy(true);
    setError(null);

    const { data, error: dbErr } = await supabase
      .from("rooms")
      .insert({
        unit_name: unitName.trim(),
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
      <PageHeader title="Yeni Oda" back />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-4 px-4 py-6"
      >
        <TextField
          label="Ünite Adı"
          required
          autoFocus
          value={unitName}
          onChange={(e) => setUnitName(e.target.value)}
          placeholder="Ör. Ünite-1"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <TextField
          label="Oda Adı"
          required
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="Ör. Pano Odası A"
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
          disabled={busy || !unitName.trim() || !roomName.trim()}
        />
      </form>
    </>
  );
}
