import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GestureSynth = lazy(() => import("@/components/GestureSynth"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Steph Evo's Sky Synth — Hand gestures instrument" },
      {
        name: "description",
        content:
          "Steph Evo's Sky Synth: suona pad, fiati, bassi e strumenti zen nel browser con le mani, scale, arpeggiatore ed effetti.",
      },
      { property: "og:title", content: "Steph Evo's Sky Synth — Hand gestures instrument" },
      {
        property: "og:description",
        content:
          "Synth gestuale interattivo con scale, arpeggiatori e effetti in tempo reale.",
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
