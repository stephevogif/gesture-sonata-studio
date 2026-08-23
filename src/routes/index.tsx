import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const SkyHome = lazy(() => import("@/components/SkyHome"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "STEPH EVO'S HEAVEN SYNTH — Choose your sky" },
      {
        name: "description",
        content:
          "Scegli in quale cielo entrare: Night Sky per suonare le stelle, Seven Heavens per gli accordi con le mani.",
      },
      { property: "og:title", content: "STEPH EVO'S HEAVEN SYNTH — Choose your sky" },
      {
        property: "og:description",
        content: "Two skies. One sound. Night Sky e Seven Heavens: strumenti gestuali nel browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "STEPH EVO'S HEAVEN SYNTH — Choose your sky" },
      {
        name: "twitter:description",
        content: "Two skies. One sound. Night Sky e Seven Heavens: strumenti gestuali nel browser.",
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
          <SkyHome />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
