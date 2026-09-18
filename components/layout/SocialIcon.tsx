import type { SocialKey } from "@/lib/site-config";

/**
 * Compact brand mark for a social profile.
 *
 * lucide-react v1 no longer ships brand glyphs, and pulling in an icon pack
 * just for five logos is not worth the dependency. Instead each network gets a
 * bordered letter tile, which suits the existing brutalist styling and stays
 * legible at small sizes. Every link that renders one of these also carries a
 * visible text label and an `aria-label`, so the tile itself is decorative.
 */
const MARKS: Record<SocialKey, string> = {
  github: "GH",
  linkedin: "in",
  twitter: "X",
  facebook: "f",
  instagram: "IG",
};

export default function SocialIcon({
  name,
  size = 18,
}: {
  name: SocialKey;
  size?: number;
}) {
  return (
    <span
      className="social-mark"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        // Scale the glyph with the tile so it stays centred at any size.
        fontSize: Math.max(8, Math.round(size * 0.52)),
      }}
    >
      {MARKS[name]}
    </span>
  );
}
