import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { TextArea, TextField, SelectField } from "../components/Form";
import { BigButton } from "../components/BigButton";
import {
  PANEL_TYPES,
  PANEL_TYPE_LABELS,
  supabase,
  type PanelType,
} from "../lib/supabase";

export default function NewPanelPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [panelType, setPanelType] = useState<PanelType>("mcc");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomId || !name.trim()) return;
    setBusy(true);
    setError(null);

    const { data, error: dbErr } = await supabase
      .from("panels")
      .insert({
        room_id: roomId,
        name: name.trim(),
        panel_type: panelType,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();

    setBusy(false);
    if (dbErr || !data) {
      setError(dbErr?.message ?? "Kaydedilemedi");
      return;
    }

    navigate(`/panels/${data.id}`, { replace: true });
  }

  return (
    <>
      <PageHeader title="Yeni Pano" back />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-xl space-y-4 px-4 py-6"
      >
        <TextField
          label="Pano Adı"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ör. MCC-A"
          autoCapitalize="characters"
          autoComplete="off"
        />
        <SelectField
          label="Pano Tipi"
          required
          value={panelType}
          onChange={(v) => setPanelType(v as PanelType)}
          options={PANEL_TYPES.map((t) => ({
            value: t,
            label: PANEL_TYPE_LABELS[t],
          }))}
        />
        <TextArea
          label="Not"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="İsteğe bağlı"
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
          disabled={busy || !name.trim()}
        />
      </form>
    </>
  );
}
