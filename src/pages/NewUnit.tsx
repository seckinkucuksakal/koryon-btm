import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { TextArea, TextField } from "../components/Form";
import { BigButton } from "../components/BigButton";
import { supabase } from "../lib/supabase";

export default function NewUnitPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);

    const { data, error: dbErr } = await supabase
      .from("units")
      .insert({
        name: name.trim(),
        description: description.trim() || null,
      })
      .select("id")
      .single();

    setBusy(false);

    if (dbErr || !data) {
      setError(dbErr?.message ?? "Kaydedilemedi");
      return;
    }

    navigate(`/units/${data.id}`, { replace: true });
  }

  return (
    <>
      <PageHeader title="Yeni Ünite" back />
      <form
        onSubmit={handleSubmit}
        className="mx-auto max-w-2xl space-y-4 px-4 py-6"
      >
        <TextField
          label="Ünite Adı"
          required
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ör. Ünite-1, Soğutma Suyu, Kazan-2"
          autoCapitalize="characters"
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
          disabled={busy || !name.trim()}
        />
      </form>
    </>
  );
}
