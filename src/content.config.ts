import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Journal entries: one Markdown file per entry in src/content/journal/.
// The filename becomes the URL: my-entry.md -> /journal/my-entry.html
const journal = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/journal" }),
  schema: z.object({
    title: z.string(),
    category: z.string(), // e.g. "Field notes" — the journal filter groups by this
    date: z.coerce.date(),
    readMinutes: z.number().default(3),
    description: z.string(), // used for <meta> and social cards
    cover: z.string(), // wide cover image URL (~21:9)
    coverAlt: z.string().default("Cover photograph for this entry"),
    preview: z.string(), // portrait image that floats next to the list row on hover
    series: z.string().optional() // slug of a related work series, e.g. "threshold"
  })
});

// Work series: one YAML file per series in src/content/work/.
// The filename becomes the URL: my-series.yaml -> /work/my-series.html
const work = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/work" }),
  schema: z.object({
    title: z.string(),
    order: z.number(), // position in the work grid and on the home page
    featured: z.boolean().default(false), // appears in "Selected work" on the home page
    year: z.string(),
    frames: z.string(),
    format: z.string(),
    status: z.string(),
    description: z.string(), // used for <meta> and the home-page feature card
    cardLabel: z.string(), // small label on the work-grid card
    cover: z.string(), // wide cover image URL (~16:9)
    coverAlt: z.string(),
    note: z.string(), // the centered statement on the series page (may contain HTML)
    strip: z.array(z.object({ src: z.string(), alt: z.string(), tall: z.boolean().default(false) })),
    images: z.array(z.object({
      src: z.string(),
      alt: z.string(),
      // layout slot in the series page grid, in order of appearance
      slot: z.enum(["left", "small-right", "full", "small-left", "right"])
    })),
    journal: z.string().optional(), // slug of a related journal entry
    next: z.string() // slug of the next series (keep the chain circular)
  })
});

export const collections = { journal, work };
