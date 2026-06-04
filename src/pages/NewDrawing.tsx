import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import DrawingCanvas from "../components/DrawingCanvas";
import { useAuth } from "../auth/AuthContext";
import { supabase } from "../lib/supabase";
import { uploadToStorage } from "../lib/storage";

export default function NewDrawingPage() {
  const { id: roomId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(blob: Blob) {
    if (!roomId || !userId) return;
    setSaving(true);
    setError(null);

    const result = await uploadToStorage({
      userId,
      folder: `drawings/${roomId}`,
      file: blob,
      filename: `cizim-${Date.now()}.png`,
      contentType: "image/png",
    });

    if ("error" in result) {
      setError(result.error);
      setSaving(false);
      return;
    }

    const { error: dbErr } = await supabase.from("drawings").insert({
      room_id: roomId,
      storage_path: result.path,
    });

    setSaving(false);

    if (dbErr) {
      setError(dbErr.message);
      return;
    }

    navigate(`/rooms/${roomId}`, { replace: true });
  }

  return (
    <>
      <PageHeader title="Serbest Çizim" subtitle="Parmağınla çizebilirsin" back />
      <div className="mx-auto max-w-3xl px-4 py-5">
        <DrawingCanvas onSave={handleSave} saving={saving} />
        {error && (
          <div className="mt-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>
    </>
  );
}
