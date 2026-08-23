import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import SkyArrival from "@/components/SkyArrival";

const HeavenSynth = lazy(() => import("@/components/HeavenSynth"));

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "STEPH EVO'S HEAVEN SYNTH" },
      {
        name: "description",
        content:
          "STEPH EVO'S HEAVEN SYNTH: suona accordi e gradi di scala con il Lato A e controlla volume, timbro e tipo di accordo con il Lato B.",
      },
      { property: "og:title", content: "STEPH EVO'S HEAVEN SYNTH" },
      {
        property: "og:description",
        content: "Modalità accordi: gradi di scala, maggiore/minore ed espressione in tempo reale.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "STEPH EVO'S HEAVEN SYNTH" },
      {
        name: "twitter:description",
        content: "Modalità accordi: gradi di scala, maggiore/minore ed espressione in tempo reale.",
      },
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
      <SkyArrival />
      <ClientOnly fallback={<div className="min-h-screen" />}>
        <Suspense fallback={<div className="min-h-screen" />}>
          <HeavenSynth />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
