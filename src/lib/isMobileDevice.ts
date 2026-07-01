/** Dokunmatik / mobil cihazlarda özel galeri seçici göster. */
export function prefersMobileGalleryPicker(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
}
