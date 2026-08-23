import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const ChordStudio = lazy(() => import("@/components/ChordStudio"));

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Chord Studio — Steph Evo's Sky Synth" },
      {
        name: "description",
        content:
          "Chord Studio: suona accordi e gradi di scala con il Lato A e controlla volume, timbro e tipo di accordo con il Lato B.",
      },
      { property: "og:title", content: "Chord Studio — Steph Evo's Sky Synth" },
      {
        property: "og:description",
        content: "Modalità accordi: gradi di scala, maggiore/minore e espressione in tempo reale.",
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
  component: StudioPage,
});

function StudioPage() {
  return (
    <main className="min-h-screen">
      <ClientOnly fallback={<div className="min-h-screen" />}>
        <Suspense fallback={<div className="min-h-screen" />}>
          <ChordStudio />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
