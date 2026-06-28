import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const DEFAULT_VISION_MODEL = "gpt-4o";

const SYSTEM_PROMPT = `Sen elektrik panosu saha mühendisisin. Görev: fotoğraftaki her fiziksel koruma modülünü soldan sağa say ve listele.

SIRALAMA:
- Fotoğraflar kullanıcının belirlediği sırayla gelir. Fotoğraf 1'den başla, sonrakilerde numaralandırmaya devam et.
- Fiziksel sıra: soldan sağa (aynı DIN hattında).

ZORUNLU SAYIM YÖNTEMİ — KOL (TOGGLE) SAY:
1. Soldan sağa sadece fotoğraf İÇİNDE tam görünen modülleri say.
2. Sayım birimi: her modülün kendi ON/OFF kolu (siyah/beyaz toggle). Kaç kol = kaç cihaz.
3. Geniş modül (RCCB, ≈2 modül genişliği) = 1 cihaz, 1 kol — iki cihaz sayma.
4. Fotoğraf kenarında yarım kesilmiş / dışarı taşan modülü SAYMA.
5. SAYILMAZ: vida, boş yuva, kapak, plaka, DIN ray, etiket şeridi, test düğmesi tek başına.
6. Sayım bitince listeyi kontrol et: satır sayısı = saydığın kol sayısı. Fazla satır ekleme.

FAZLA SAYMA YAPMA — sık hata:
- Geniş RCCB'yi hem ana şalter hem RCD diye ikiye bölmek ✗
- 6 MCB varken 7 MCB yazmak ✗ (vidalar veya kesik parçayı MCB sanmak)
- Aynı cihazı iki kez listelemek ✗

FİZİKSEL CİHAZ = TEK SATIR — ASLA BÖLME:
- 25A ve 30mA AYNI geniş modülde → TEK satır RCCB (ana şalter + RCD diye iki satır YAZMA).
- 30mA, 300mA, IΔn, 0,03A, test (T) düğmesi görürsen → RCCB/RCD, ana şalter DEĞİL.
- Ana şalter yalnızca kaçak akım değeri olmayan saf giriş şalteri ise.

TÜR TANIMA:
- MCB: dar modül, B10/C16/C25, trip B veya C
- RCCB/RCD: geniş modül (≈2 genişlik), 30mA/300mA, T düğmesi, trip YAZMA
- RCBO: tek modülde hem trip hem 30mA

YAZMA (Marka, Model, Kutup, devre etiketi YAZMA):
- MCB: Tür: Otomatik sigorta (MCB) | Akım: … | Trip: B/C/D
- RCCB: Tür: Kaçak akım rölesi (RCCB) | Akım: … | Kaçma: 30mA/300mA/…
- RCBO: Tür: RCBO | Akım: … | Trip: … | Kaçma: …
- Ana şalter (RCD değilse): Tür: Ana şalter | Akım: … | Trip: …

Okunamayan: "okunamadı". Tahmin etme.

ÇIKTI:
## Pano Özeti
## Genel Bilgiler
- Toplam koruma elemanı: N (listede N satır olmalı)
- RCCB/RCD adedi: …
- MCB adedi: …
## Koruma Elemanları
1. …
## Dikkat Edilecekler
Sayım belirsizse kısa not yaz; yine de fazla satır ekleme.`;

type VisionImage = {
  imageBase64?: string;
  base64?: string;
  mimeType: string;
  order?: number;
};

function imagePayload(img: VisionImage): string | null {
  const data = img.imageBase64?.trim() || img.base64?.trim();
  return data || null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function buildUserContent(images: VisionImage[]) {
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string; detail: "high" } }
  > = [];

  const countInstruction =
    "Adım 1: Fotoğraf içinde tam görünen ON/OFF kollarını soldan sağa say (geniş modül=1 RCCB, dar modül=1 MCB). " +
    "Kenarda yarım kesilen modülü sayma. Vida/boş yuvayı sayma. " +
    "Adım 2: Saydığın kadar satır yaz — fazla satır ekleme. " +
    "30mA olan geniş modül = tek RCCB satırı.";

  if (images.length === 1) {
    content.push({
      type: "text",
      text: `FOTOĞRAF 1: ${countInstruction}`,
    });
  } else {
    content.push({
      type: "text",
      text: `${images.length} fotoğraf, sırayla birleştir. ${countInstruction}`,
    });
  }

  images.forEach((img, idx) => {
    const n = img.order ?? idx + 1;
    const payload = imagePayload(img);
    if (!payload) return;
    const mime = img.mimeType?.startsWith("image/") ? img.mimeType : "image/jpeg";

    if (images.length > 1) {
      content.push({
        type: "text",
        text:
          n === 1
            ? `FOTOĞRAF ${n} (BAŞLANGIÇ):`
            : `FOTOĞRAF ${n} (devam):`,
      });
    }

    content.push({
      type: "image_url",
      image_url: {
        url: `data:${mime};base64,${payload}`,
        detail: "high",
      },
    });
  });

  return content;
}

function createHandler(apiKey: string | undefined, visionModel: string) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.startsWith("/api/vision/analyze")) {
      next();
      return;
    }

    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Yalnızca POST desteklenir." }));
      return;
    }

    if (!apiKey) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: "OPENAI_API_KEY tanımlı değil. .env.local dosyasına ekleyin.",
        }),
      );
      return;
    }

    try {
      const raw = await readBody(req);
      const body = JSON.parse(raw) as {
        images?: VisionImage[];
        imageBase64?: string;
        mimeType?: string;
      };

      let images: VisionImage[] = [];

      if (Array.isArray(body.images) && body.images.length > 0) {
        images = body.images
          .filter((img) => imagePayload(img))
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      } else if (body.imageBase64?.trim() || (body as { base64?: string }).base64?.trim()) {
        const legacy = body as { imageBase64?: string; base64?: string; mimeType?: string };
        images = [
          {
            imageBase64: legacy.imageBase64 ?? legacy.base64 ?? "",
            mimeType: legacy.mimeType?.startsWith("image/")
              ? legacy.mimeType
              : "image/jpeg",
            order: 1,
          },
        ].filter((img) => imagePayload(img));
      }

      if (images.length === 0) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Görsel verisi eksik." }));
        return;
      }

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: visionModel,
          max_tokens: 4096,
          temperature: 0,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: buildUserContent(images) },
          ],
        }),
      });

      const openaiData = (await openaiRes.json()) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };

      if (!openaiRes.ok) {
        res.statusCode = openaiRes.status;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            error: openaiData.error?.message ?? "OpenAI isteği başarısız.",
          }),
        );
        return;
      }

      const text = openaiData.choices?.[0]?.message?.content ?? "";
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ text }));
    } catch (err) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : "Bilinmeyen sunucu hatası",
        }),
      );
    }
  };
}

export function visionProxyPlugin(
  apiKey: string | undefined,
  visionModel = DEFAULT_VISION_MODEL,
): Plugin {
  const handler = createHandler(apiKey, visionModel);
  return {
    name: "vision-proxy",
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}
