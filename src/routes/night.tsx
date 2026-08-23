import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GestureSynth = lazy(() => import("@/components/GestureSynth"));

export const Route = createFileRoute("/night")({
  head: () => ({
    meta: [
      { title: "NIGHT SKY — STEPH EVO'S HEAVEN SYNTH" },
      {
        name: "description",
        content:
          "Night Sky: suona le stelle con le mani, scale, arpeggiatore, effetti e rilevamento automatico della tonalità.",
      },
      { property: "og:title", content: "NIGHT SKY — STEPH EVO'S HEAVEN SYNTH" },
      {
        property: "og:description",
        content: "Touch the stars. Play the night: strumento gestuale con scale, arpeggi ed effetti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "NIGHT SKY — STEPH EVO'S HEAVEN SYNTH" },
      {
        name: "twitter:description",
        content: "Touch the stars. Play the night: strumento gestuale con scale, arpeggi ed effetti.",
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
  component: NightPage,
});

function NightPage() {
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
