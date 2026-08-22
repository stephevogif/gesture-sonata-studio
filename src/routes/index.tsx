import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GestureSynth = lazy(() => import("@/components/GestureSynth"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Gesture Synth — Suona violino, fiati e pads con le mani" },
      {
        name: "description",
        content:
          "Synth gestuale nel browser: muovi le mani davanti alla webcam per suonare violino, fiati e pads. Nessun contatto, solo aria.",
      },
      { property: "og:title", content: "Gesture Synth — Strumento gestuale nel browser" },
      {
        property: "og:description",
        content:
          "Controlla nota, timbro e volume con i gesti delle mani. Violino, fiati e pads dal vivo nel browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;600&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="min-h-screen">
      <ClientOnly fallback={<div className="min-h-screen" />}>
        <Suspense fallback={<div className="min-h-screen" />}>
          <GestureSynth />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
