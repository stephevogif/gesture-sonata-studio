import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GestureSynth = lazy(() => import("@/components/GestureSynth"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STEPH EVO'S SKY SYNTH — strumento gestuale" },
      {
        name: "description",
        content:
          "STEPH EVO'S SKY SYNTH: suona pad, fiati, bassi e strumenti zen nel browser, con scale, arpeggiatore ed effetti.",
      },
      { property: "og:title", content: "STEPH EVO'S SKY SYNTH — strumento gestuale" },
      {
        property: "og:description",
        content:
          "STEPH EVO'S SKY SYNTH: scale, arpeggiatori ed effetti in tempo reale, tutto controllato dai movimenti.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "STEPH EVO'S SKY SYNTH — strumento gestuale" },
      {
        name: "twitter:description",
        content:
          "STEPH EVO'S SKY SYNTH: scale, arpeggiatori ed effetti in tempo reale, tutto controllato dai movimenti.",
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
