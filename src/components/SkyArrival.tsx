import { useEffect, useState } from "react";

export const SKY_WARP_KEY = "sky-warp-tone";

/**
 * Overlay puramente visivo: continua l'aura/gradiente della home
 * mentre la pagina strumento entra in scena. Nessun impatto sull'audio.
 */
export default function SkyArrival() {
  const [tone, setTone] = useState<"night" | "heaven" | null>(null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    let t: "night" | "heaven" | null = null;
    try {
      const v = sessionStorage.getItem(SKY_WARP_KEY);
      if (v === "night" || v === "heaven") t = v;
      sessionStorage.removeItem(SKY_WARP_KEY);
    } catch {
      t = null;
    }
    if (!t) return;
    setTone(t);
    const a = window.setTimeout(() => setOut(true), 40);
    const b = window.setTimeout(() => setTone(null), 1100);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, []);

  if (!tone) return null;

  return (
    <div className={`sky-arrive sky-arrive-${tone} ${out ? "sky-arrive-out" : ""}`} aria-hidden />
  );
}
