import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Writer — A quieter place to write" },
      { name: "description", content: "A simple, theme-aware text editor with rich formatting, images, checklists and tables. Everything stays on your device." },
      { property: "og:title", content: "Writer — A quieter place to write" },
      { property: "og:description", content: "Write, format, and create in a distraction-free editor. No account or backend required." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <iframe className="writer-frame" src="/writer/index.html" title="Writer text editor" />;
}
