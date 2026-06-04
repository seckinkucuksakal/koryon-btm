import { renderToStaticMarkup } from "react-dom/server";
import { renderObject } from "./ObjectRenderers";
import type { SceneJSON } from "./types";

export function sceneToSvgString(scene: SceneJSON): string {
  const inner = scene.objects.map((o) =>
    renderObject(o, scene, { selected: false }),
  );
  const tree = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      width={scene.width}
      height={scene.height}
    >
      <rect
        x={0}
        y={0}
        width={scene.width}
        height={scene.height}
        fill="#ffffff"
      />
      {inner}
    </svg>
  );
  return renderToStaticMarkup(tree);
}

export async function svgStringToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = 2,
): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D bağlamı alınamadı");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG dönüştürülemedi"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("SVG yüklenemedi"));
    img.src = src;
  });
}

export function downloadFile(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
