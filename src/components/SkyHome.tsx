import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SKY_WARP_KEY } from "./SkyArrival";

type Phase = "intro" | "home";
type SkyId = "heaven" | "onehand" | "night";

const HINT_KEY = "sky-home-hint-seen";

function StarGlyph() {
  return (
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
  );
}

/* mano astratta / simbolo astrologico, monocromatico */
function HandGlyph() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor">
      <circle cx="50" cy="50" r="42" strokeWidth="1" opacity="0.35" />
      <path
        d="M30 62V40M40 62V30M50 62V26M60 62V32M70 62V44"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path d="M30 62a20 20 0 0 0 40 0" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="50" cy="63" r="7" strokeWidth="1.6" />
      <circle cx="50" cy="63" r="2.4" fill="currentColor" stroke="none" />
      <path d="M30 40l-.001-.001M50 20l3 6-3 6-3-6z" strokeWidth="1.4" />
    </svg>
  );
}

/* luna crescente con stella */
function MoonGlyph() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" stroke="currentColor">
      <circle cx="50" cy="50" r="42" strokeWidth="1" opacity="0.35" />
      <path
        d="M62 22a32 32 0 1 0 0 56 34 34 0 0 1 0-56z"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M72 38l2.6 7.4L82 48l-7.4 2.6L72 58l-2.6-7.4L62 48l7.4-2.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}

type SkyDef = {
  id: SkyId;
  title: string;
  sub: React.ReactNode;
  meta: string;
  metaClass: string;
  auraClass: string;
  orbitClass: string;
  glyph: React.ReactNode;
  label: string;
};

const SKIES: SkyDef[] = [
  {
    id: "heaven",
    title: "SEVEN HEAVENS",
    sub: (
      <>
        Raise your hands.
        <br />
        Reach a Heaven.
      </>
    ),
    meta: "I · II · III · IV · V · VI · VII",
    metaClass: "sky-meta-heaven",
    auraClass: "sky-aura-heaven",
    orbitClass: "sky-orbit-heaven",
    glyph: <StarGlyph />,
    label: "Entra in Seven Heavens",
  },
  {
    id: "onehand",
    title: "ONE HAND",
    sub: (
      <>
        One Hand Easy Cover Mode.
        <br />
        Five fingers, five chords.
      </>
    ),
    meta: "SONGS · COVER · EASY",
    metaClass: "sky-meta-onehand",
    auraClass: "sky-aura-onehand",
    orbitClass: "sky-orbit-onehand",
    glyph: <HandGlyph />,
    label: "Entra in One Hand Easy Cover Mode",
  },
  {
    id: "night",
    title: "NIGHT SKY",
    sub: (
      <>
        Touch the stars.
        <br />
        Play the night.
      </>
    ),
    meta: "TOUCH · FREE · DETECT",
    metaClass: "sky-meta-night",
    auraClass: "sky-aura-night",
    orbitClass: "sky-orbit-night",
    glyph: <MoonGlyph />,
    label: "Entra in Night Sky",
  },
];

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
  const [leaving, setLeaving] = useState<null | SkyId>(null);
  const [showHint, setShowHint] = useState(true);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);

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

  const active = SKIES[index]!;

  const move = (delta: 1 | -1) => {
    if (leaving) return;
    setDir(delta);
    setAnimKey((k) => k + 1);
    setIndex((i) => (i + delta + SKIES.length) % SKIES.length);
  };

  const enter = (which: SkyId) => {
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

            <div className="sky-carousel sky-reveal-1">
              <button
                type="button"
                className="sky-arrow sky-arrow-prev"
                aria-label="Modalità precedente"
                onClick={() => move(-1)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path d="M15 4 L7 12 L15 20 Z" fill="currentColor" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => enter(active.id)}
                aria-label={active.label}
                className={`sky-portal sky-portal-${active.id} ${
                  leaving === active.id ? "sky-portal-chosen" : ""
                }`}
              >
                <span className={`sky-aura ${active.auraClass}`} aria-hidden />
                <span className={`sky-orbit ${active.orbitClass}`} aria-hidden />
                <span
                  key={animKey}
                  className={`sky-content sky-slide-${dir > 0 ? "next" : "prev"}`}
                >
                  <span className="sky-glyph" aria-hidden>
                    {active.glyph}
                  </span>
                  <span className="sky-portal-title">{active.title}</span>
                  <span className="sky-portal-rule" aria-hidden>
                    ✦
                  </span>
                  <span className="sky-portal-sub">{active.sub}</span>
                  <span className={`sky-portal-meta ${active.metaClass}`}>{active.meta}</span>
                </span>
                {showHint && <TapHand delay="0s" />}
              </button>

              <button
                type="button"
                className="sky-arrow sky-arrow-next"
                aria-label="Modalità successiva"
                onClick={() => move(1)}
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
                  <path d="M9 4 L17 12 L9 20 Z" fill="currentColor" />
                </svg>
              </button>
            </div>

            <div className="sky-dots sky-reveal-2" role="tablist" aria-label="Modalità">
              {SKIES.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={s.title}
                  className={`sky-dot ${i === index ? "sky-dot-on" : ""}`}
                  onClick={() => {
                    if (i === index) return;
                    setDir(i > index ? 1 : -1);
                    setAnimKey((k) => k + 1);
                    setIndex(i);
                  }}
                />
              ))}
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
