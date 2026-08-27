import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SKY_WARP_KEY } from "./SkyArrival";

function FatimaHand({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      aria-hidden
    >
      {/* palmo */}
      <path
        d="M32 58c8 0 14-5 14-13V36c0-3-2-5-4-5s-4 2-4 5v6h-2v-6c0-3-2-5-4-5s-4 2-4 5v6h-2v-6c0-3-2-5-4-5s-4 2-4 5v6h-2v-6c0-3-2-5-4-5s-4 2-4 5v9c0 8 6 13 14 13z"
        fill="currentColor"
        fillOpacity="0.18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* pollice sinistro */}
      <path
        d="M18 34c-4-3-7-9-6-14 1-4 5-5 8-3 3 2 4 7 2 11"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dito indice */}
      <path
        d="M22 34V18c0-4 2-8 6-8s6 4 6 8v16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dito medio */}
      <path
        d="M32 34V14c0-4 2-8 6-8s6 4 6 8v20"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dito anulare */}
      <path
        d="M42 34V18c0-4 2-8 6-8s6 4 6 8v16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* dito mignolo */}
      <path
        d="M52 34c3-2 5-6 4-10-1-3-4-4-7-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* occhio di Fatima */}
      <circle cx="32" cy="42" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="32" cy="42" r="2.2" fill="currentColor" fillOpacity="0.35" />
      <path d="M24 42c0-4.4 3.6-8 8-8s8 3.6 8 8-3.6 8-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

type Phase = "intro" | "home";

const HINT_KEY = "sky-home-hint-seen";

function Sparkle({ tone }: { tone: "night" | "heaven" }) {
  return (
    <span className={`sky-star sky-star-${tone}`} aria-hidden>
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path
          d="M50 2 L57 43 L98 50 L57 57 L50 98 L43 57 L2 50 L43 43 Z"
          fill="currentColor"
        />
        <path
          d="M50 12 L54 46 L88 50 L54 54 L50 88 L46 54 L12 50 L46 46 Z"
          fill="currentColor"
          opacity="0.8"
          transform="rotate(45 50 50)"
        />
      </svg>
    </span>
  );
}

function TapHand({ delay }: { delay: string }) {
  return (
    <span className="sky-hand sky-hand-portal" style={{ animationDelay: delay }} aria-hidden>
      <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
        <path d="M12 3l3 3M12 3L9 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path
          d="M10 21h4.5a3 3 0 0 0 3-3v-4.2c0-.7-.6-1.3-1.3-1.3s-1.3.6-1.3 1.3V12c0-.7-.6-1.3-1.3-1.3s-1.3.6-1.3 1.3V9.2c0-.7-.6-1.3-1.3-1.3S10 8.5 10 9.2v6l-1.4-1.4a1.3 1.3 0 0 0-1.9 1.8L10 21z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}


export default function SkyHome() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [leaving, setLeaving] = useState<null | "night" | "heaven" | "onehand">(null);
  const [showHint, setShowHint] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setPhase("home"), 1500);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(HINT_KEY)) setShowHint(false);
  }, []);

  const stars = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        left: (i * 37.7) % 100,
        top: (i * 61.3) % 100,
        size: 1 + ((i * 13) % 3) * 0.7,
        delay: (i % 11) * 0.9,
        dur: 5 + (i % 7),
      })),
    [],
  );

  const enter = (which: "night" | "heaven" | "onehand") => {
    if (leaving) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(HINT_KEY, "1");
      try {
        sessionStorage.setItem(SKY_WARP_KEY, which);
      } catch {
        /* storage non disponibile */
      }
    }
    setShowHint(false);
    setLeaving(which);
    window.setTimeout(() => {
      if (which === "night") {
        void navigate({ to: "/night" });
      } else if (which === "onehand") {
        void navigate({ to: "/studio", search: { oneHand: 1 } });
      } else {
        void navigate({ to: "/studio" });
      }
    }, 720);
  };

  return (
    <div className={`sky-home ${leaving ? `sky-home-leaving sky-leave-${leaving}` : ""}`}>

      {/* background: un unico viaggio verticale notte → alba → nuvole */}
      <div className="sky-home-bg" aria-hidden />
      <div className="sky-home-nebula" aria-hidden />
      <div className="sky-home-clouds" aria-hidden />
      <div className="sky-home-stars" aria-hidden>
        {stars.map((s, i) => (
          <span
            key={i}
            style={{
              left: `${s.left}%`,
              top: `${s.top}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-5 pb-10 pt-8">
        {/* logo */}
        <header className={`sky-logo ${phase === "intro" ? "sky-logo-intro" : "sky-logo-home"}`}>
          <p className="sky-logo-top">STEPH EVO&apos;S</p>
          <h1 className="sky-logo-main">HEAVEN SYNTH</h1>
          <div className="sky-rule" aria-hidden>
            <span />✦<span />
          </div>
        </header>

        {phase === "home" && (
          <>
            <p className="sky-choose">CHOOSE YOUR SKY</p>

            <div className="sky-portals">
              {/* SEVEN HEAVENS */}
              <button
                type="button"
                onClick={() => enter("heaven")}
                aria-label="Entra in Seven Heavens"
                className={`sky-portal sky-portal-heaven sky-reveal-1 ${
                  leaving === "heaven" ? "sky-portal-chosen" : ""
                } ${leaving === "night" ? "sky-portal-dimmed" : ""}`}
              >
                <span className="sky-aura sky-aura-heaven" aria-hidden />
                <span className="sky-orbit sky-orbit-heaven" aria-hidden />
                <span className="sky-content">
                  <Sparkle tone="heaven" />
                  <span className="sky-portal-title">SEVEN HEAVENS</span>
                  <span className="sky-portal-rule" aria-hidden>
                    ✦
                  </span>
                  <span className="sky-portal-sub">
                    Raise your hands.
                    <br />
                    Reach a Heaven.
                  </span>
                  <span className="sky-portal-meta sky-meta-heaven">
                    I · II · III · IV · V · VI · VII
                  </span>
                </span>
                {showHint && <TapHand delay="0s" />}
              </button>

              {/* ONE HAND */}
              <button
                type="button"
                onClick={() => enter("onehand")}
                aria-label="Entra in One Hand Easy Cover Mode"
                className={`sky-portal sky-portal-onehand sky-reveal-2 ${
                  leaving === "onehand" ? "sky-portal-chosen" : ""
                } ${leaving && leaving !== "onehand" ? "sky-portal-dimmed" : ""}`}
              >
                <span className="sky-aura sky-aura-onehand" aria-hidden />
                <span className="sky-orbit sky-orbit-onehand" aria-hidden />
                <span className="sky-content">
                  <FatimaHand className="h-[74px] w-[74px] text-[#fff5e6] drop-shadow-[0_0_18px_rgba(255,205,160,0.85)]" />
                  <span className="sky-portal-title">ONE HAND</span>
                  <span className="sky-portal-rule" aria-hidden>
                    ✦
                  </span>
                  <span className="sky-portal-sub">
                    One Hand Easy Cover Mode.
                    <br />
                    Five fingers, five chords.
                  </span>
                  <span className="sky-portal-meta sky-meta-onehand">FATIMA · SONGS · COVER</span>
                </span>
                {showHint && <TapHand delay="1.3s" />}
              </button>

              {/* NIGHT SKY */}
              <button
                type="button"
                onClick={() => enter("night")}
                aria-label="Entra in Night Sky"
                className={`sky-portal sky-portal-night sky-reveal-3 ${
                  leaving === "night" ? "sky-portal-chosen" : ""
                } ${leaving && leaving !== "night" ? "sky-portal-dimmed" : ""}`}
              >
                <span className="sky-aura sky-aura-night" aria-hidden />
                <span className="sky-orbit sky-orbit-night" aria-hidden />
                <span className="sky-content">
                  <Sparkle tone="night" />
                  <span className="sky-portal-title">NIGHT SKY</span>
                  <span className="sky-portal-rule" aria-hidden>
                    ✦
                  </span>
                  <span className="sky-portal-sub">
                    Touch the stars.
                    <br />
                    Play the night.
                  </span>
                  <span className="sky-portal-meta sky-meta-night">TOUCH · FREE · DETECT</span>
                </span>
                {showHint && <TapHand delay="2.6s" />}
              </button>

            </div>

            <div className="sky-hint-wrap sky-reveal-3">
              <p className="sky-tap">TAP A SKY TO ENTER</p>
              <p className="sky-foot">THREE SKIES. ONE SOUND.</p>
            </div>
          </>
        )}
      </div>

      {leaving && <div className={`sky-warp sky-warp-${leaving}`} aria-hidden />}
    </div>
  );
}

