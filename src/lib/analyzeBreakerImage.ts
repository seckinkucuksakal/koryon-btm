import {
  prepareImageForVision,
  type PreparedVisionImage,
} from "./prepareImageForVision";

export type PanelImageInput = {
  order: number;
  file: File;
  prepared?: PreparedVisionImage;
};

export type PanelAnalysisResult = {
  text: string;
};

export async function analyzePanelImages(
  items: PanelImageInput[],
  onStage?: (stage: "prepare" | "analyze") => void,
): Promise<PanelAnalysisResult> {
  if (items.length === 0) {
    throw new Error("En az bir fotoğraf gerekli.");
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);
  const images: Array<{
    imageBase64: string;
    mimeType: string;
    order: number;
  }> = [];

  const needsPrepare = sorted.filter((item) => !item.prepared?.base64);
  if (needsPrepare.length > 0) onStage?.("prepare");

  for (const item of sorted) {
    const prepared =
      item.prepared?.base64 ? item.prepared : await prepareImageForVision(item.file);
    if (!prepared.base64.trim()) {
      throw new Error(`Fotoğraf ${item.order} okunamadı.`);
    }
    images.push({
      imageBase64: prepared.base64,
      mimeType: prepared.mimeType,
      order: item.order,
    });
  }

  onStage?.("analyze");

  const response = await fetch("/api/vision/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

  const data = (await response.json()) as {
    text?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error ?? `Analiz hatası (${response.status})`);
  }

  if (!data.text?.trim()) {
    throw new Error("Model yanıt üretemedi.");
  }

  return { text: data.text.trim() };
}

export function warmPreparePanelImages(
  items: Array<{ id: string; file: File }>,
  onPrepared: (id: string, prepared: PreparedVisionImage) => void,
) {
  for (const item of items) {
    prepareImageForVision(item.file)
      .then((prepared) => onPrepared(item.id, prepared))
      .catch(() => {
        /* yeniden analizde tekrar denenecek */
      });
  }
}
