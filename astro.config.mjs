import { defineConfig } from "astro/config";

// build.format "file" keeps the original URL scheme intact:
// src/pages/work.astro -> /work.html, src/pages/work/[slug].astro -> /work/<slug>.html
export default defineConfig({
  site: "https://dayne.online",
  build: { format: "file" }
});
