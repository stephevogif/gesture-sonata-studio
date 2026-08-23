import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

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
          d="M50 18 L53 47 L82 50 L53 53 L50 82 L47 53 L18 50 L47 47 Z"
          fill="currentColor"
          opacity="0.85"
        />
      </svg>
    </span>
  );
}

export default function SkyHome() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("intro");
  const [leaving, setLeaving] = useState<null | "night" | "heaven">(null);
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

  const enter = (which: "night" | "heaven") => {
    if (leaving) return;
    if (typeof window !== "undefined") localStorage.setItem(HINT_KEY, "1");
    setShowHint(false);
    setLeaving(which);
    window.setTimeout(() => {
      void navigate({ to: which === "night" ? "/night" : "/studio" });
    }, 520);
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

            <div className="mt-6 flex flex-1 flex-col items-center justify-center gap-10 md:flex-row md:gap-8">
              {/* NIGHT SKY */}
              <button
                type="button"
                onClick={() => enter("night")}
                aria-label="Entra in Night Sky"
                className="sky-portal sky-portal-night sky-reveal-1"
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
              </button>

              {/* SEVEN HEAVENS */}
              <button
                type="button"
                onClick={() => enter("heaven")}
                aria-label="Entra in Seven Heavens"
                className="sky-portal sky-portal-heaven sky-reveal-2"
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
              </button>
            </div>

            <div className="sky-hint-wrap sky-reveal-3">
              {showHint && (
                <span className="sky-hand" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7">
                    <path
                      d="M12 3l3 3M12 3L9 6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                    <path
                      d="M10 21h4.5a3 3 0 0 0 3-3v-4.2c0-.7-.6-1.3-1.3-1.3s-1.3.6-1.3 1.3V12c0-.7-.6-1.3-1.3-1.3s-1.3.6-1.3 1.3V9.2c0-.7-.6-1.3-1.3-1.3S10 8.5 10 9.2v6l-1.4-1.4a1.3 1.3 0 0 0-1.9 1.8L10 21z"
                      stroke="currentColor"
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              )}
              <p className="sky-tap">TAP A SKY TO ENTER</p>
              <p className="sky-foot">TWO SKIES. ONE SOUND.</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
