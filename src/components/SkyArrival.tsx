import { useEffect, useRef, useState } from "react";

export const SKY_WARP_KEY = "sky-warp-tone";

/**
 * Overlay puramente visivo: continua l'aura/gradiente della home
 * mentre la pagina strumento entra in scena. Nessun impatto sull'audio.
 */
export default function SkyArrival() {
  const readRef = useRef<"night" | "heaven" | null | undefined>(undefined);
  if (readRef.current === undefined) {
    let t: "night" | "heaven" | null = null;
    try {
      const v = sessionStorage.getItem(SKY_WARP_KEY);
      if (v === "night" || v === "heaven") t = v;
      sessionStorage.removeItem(SKY_WARP_KEY);
    } catch {
      t = null;
    }
    readRef.current = t;
  }

  const tone = readRef.current ?? null;
  const [visible, setVisible] = useState(tone !== null);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!tone) return;
    const a = window.setTimeout(() => setOut(true), 60);
    const b = window.setTimeout(() => setVisible(false), 1400);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [tone]);

  if (!tone || !visible) return null;

  const bg =
    tone === "night"
      ? "radial-gradient(circle at 50% 46%, rgba(70,120,235,0.55), transparent 62%), linear-gradient(180deg, #04060f, #0a1230 60%, #060a1c)"
      : "radial-gradient(circle at 50% 54%, rgba(255,214,150,0.6), transparent 62%), linear-gradient(180deg, #7fb3e8, #f7ddb8 100%)";

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        pointerEvents: "none",
        background: bg,
        opacity: out ? 0 : 1,
        transform: out ? "scale(1.08)" : "scale(1)",
        transition: "opacity 1s ease, transform 1.1s cubic-bezier(0.22,1,0.36,1)",
      }}
    />
  );
}
