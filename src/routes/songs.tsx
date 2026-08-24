import { createFileRoute } from "@tanstack/react-router";
import SongLibrary from "@/components/songs/SongLibrary";

const TITLE = "Heaven Songs — Play songs with your hands";
const DESC =
  "Heaven Songs: scegli una canzone, Seven Heavens imposta tonalità e scala e tu suoni la progressione con i gesti 1–7.";

export const Route = createFileRoute("/songs")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://gesture-sonata-studio.lovable.app/songs" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
    ],
    links: [{ rel: "canonical", href: "https://gesture-sonata-studio.lovable.app/songs" }],
  }),
  component: SongsPage,
});

function SongsPage() {
  return (
    <main className="min-h-screen">
      <SongLibrary />
    </main>
  );
}
