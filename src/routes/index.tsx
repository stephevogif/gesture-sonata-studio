import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const GestureSynth = lazy(() => import("@/components/GestureSynth"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STEPH EVO'S CRAZY THERAMIN — GESTURE MUSIC" },
      {
        name: "description",
        content:
          "Steph Evo's Crazy Theramin: suona bassi, pad e fiati nel browser con scale, arpeggiatore ed effetti.",
      },
      { property: "og:title", content: "STEPH EVO'S CRAZY THERAMIN — GESTURE MUSIC" },
      {
        property: "og:description",
        content:
          "Bassi aggressivi, arpeggiatori, scale e effetti in tempo reale.",
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
