// Placeholder-image helpers.
//
// All photography is currently picsum.photos placeholders whose URLs encode
// their dimensions: https://picsum.photos/seed/<seed>/<w>/<h>?grayscale
// These helpers derive responsive srcsets from that pattern.
//
// WHEN REAL PHOTOGRAPHS ARRIVE: put originals in src/assets/photos/, switch
// the <Pic> component to astro:assets' <Image> (which generates the variants
// at build time), and delete this file. Content files then reference local
// paths instead of picsum URLs.

const PICSUM = /^https:\/\/picsum\.photos\/seed\/([\w-]+)\/(\d+)\/(\d+)/;

export function parsePicsum(src: string) {
  const m = src.match(PICSUM);
  if (!m) return null;
  return { seed: m[1], width: Number(m[2]), height: Number(m[3]) };
}

export function picsumSrcset(src: string): string | undefined {
  const p = parsePicsum(src);
  if (!p || p.width < 1200) return undefined;
  const ratio = p.height / p.width;
  return [800, 1600, 2400]
    .map((w) => `https://picsum.photos/seed/${p.seed}/${w}/${Math.round(w * ratio)}?grayscale ${w}w`)
    .join(", ");
}
